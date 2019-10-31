"use strict";

// https://serverless.com/blog/writing-serverless-plugins/
// https://serverless.com/framework/docs/providers/aws/guide/plugins/
// https://github.com/softprops/lambda-rust/

const { spawnSync, execSync } = require("child_process");
const { homedir } = require("os");
const path = require("path");

const DEFAULT_DOCKER_TAG = "0.2.4-rust-1.38.0";
const RUST_RUNTIME = "rust";
const BASE_RUNTIME = "provided";
const NO_OUTPUT_CAPTURE = { stdio: ["ignore", process.stdout, process.stderr] };

function includeInvokeHook(serverlessVersion) {
  let [major, minor] = serverlessVersion.split(".");
  let majorVersion = parseInt(major);
  let minorVersion = parseInt(minor);
  return majorVersion === 1 && minorVersion >= 38 && minorVersion < 40;
}

/** assumes docker is on the host's execution path */
class RustPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.servicePath = this.serverless.config.servicePath || "";
    this.hooks = {
      "before:package:createDeploymentArtifacts": this.build.bind(this),
      "before:deploy:function:packageFunction": this.build.bind(this)
    };
    if (includeInvokeHook(serverless.version)) {
      this.hooks["before:invoke:local:invoke"] = this.build.bind(this);
    }
    this.custom = Object.assign(
      {
        cargoFlags: "",
        dockerTag: DEFAULT_DOCKER_TAG
      },
      (this.serverless.service.custom && this.serverless.service.custom.rust) ||
        {}
    );

    // By default, Serverless examines node_modules to figure out which
    // packages there are from dependencies versus devDependencies of a
    // package. While there will always be a node_modules due to Serverless
    // and this plugin being installed, it will be excluded anyway.
    // Therefore, the filtering can be disabled to speed up (~3.2s) the process.
    this.serverless.service.package.excludeDevDependencies = false;
  }

  compileFunctionBinary(funcArgs, cargoPackage, binary, dockerless) {
    if (dockerless) {
      return this.buildFromShell(funcArgs, cargoPackage, binary);
    }
    return this.buildInDocker(funcArgs, cargoPackage, binary);
  }

  buildInDocker(funcArgs, cargoPackage, binary) {
    const dockerTag = (funcArgs || {}).dockerTag || this.custom.dockerTag;
    return spawnSync(
      "docker",
      [
        ...this.getDockerArgs(funcArgs, cargoPackage, binary),
        `softprops/lambda-rust:${dockerTag}`
      ],
      NO_OUTPUT_CAPTURE
    );
  }

  buildFromShell(funcArgs, cargoPackage, binary) {
    const buildCommand = [`BIN=${binary}`, `${__dirname}/build.sh`];
    const cargoFlags = this.getCargoFlags(funcArgs, cargoPackage);
    if (cargoFlags) {
      buildCommand.unshift(`CARGO_FLAGS="${cargoFlags}"`);
    }
    return execSync(`${buildCommand.join(" ")}`);
  }

  getDockerArgs(funcArgs, cargoPackage, binary) {
    const cargoHome = process.env.CARGO_HOME || path.join(homedir(), ".cargo");
    const cargoRegistry = path.join(cargoHome, "registry");
    const cargoDownloads = path.join(cargoHome, "git");
    const args = [
      "run",
      "--rm",
      "-t",
      "-e",
      `BIN=${binary}`,
      `-v`,
      `${this.servicePath}:/code`,
      `-v`,
      `${cargoRegistry}:/root/.cargo/registry`,
      `-v`,
      `${cargoDownloads}:/root/.cargo/git`
    ];
    const cargoFlags = this.getCargoFlags(funcArgs, cargoPackage);
    if (cargoFlags) {
      // --features awesome-feature, ect
      args.push("-e", `CARGO_FLAGS=${cargoFlags}`);
    }
    return args;
  }

  getCargoFlags(funcArgs, cargoPackage) {
    let cargoFlags = (funcArgs || {}).cargoFlags || this.custom.cargoFlags;
    if (cargoPackage != undefined) {
      if (cargoFlags) {
        cargoFlags = `${cargoFlags} -p ${cargoPackage}`;
      } else {
        cargoFlags = ` -p ${cargoPackage}`;
      }
    }

    return cargoFlags;
  }

  functions() {
    if (this.options.function) {
      return [this.options.function];
    } else {
      return this.serverless.service.getAllFunctions();
    }
  }

  build() {
    const service = this.serverless.service;
    if (service.provider.name != "aws") {
      return;
    }
    let rustFunctionsFound = false;
    this.functions().forEach(funcName => {
      const func = service.getFunction(funcName);
      const runtime = func.runtime || service.provider.runtime;
      if (runtime != RUST_RUNTIME) {
        // skip functions which don't apply to rust
        return;
      }
      rustFunctionsFound = true;
      let [cargoPackage, binary] = func.handler.split(".");
      if (binary == undefined) {
        binary = cargoPackage;
      }
      this.serverless.cli.log(`Building native Rust ${func.handler} func...`);
      const res = this.compileFunctionBinary(
        func.rust,
        cargoPackage,
        binary,
        this.custom.dockerless
      );
      if (res.error || res.status > 0) {
        this.serverless.cli.log(
          `Rust build encountered an error: ${res.error} ${res.status}.`
        );
        throw new Error(res.error);
      }
      // If all went well, we should now have find a packaged compiled binary under `target/lambda/release`.
      //
      // The AWS "provided" lambda runtime requires executables to be named
      // "bootstrap" -- https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html
      //
      // To avoid artifact nameing conflicts when we potentially have more than one function
      // we leverage the ability to declare a package artifact directly
      // see https://serverless.com/framework/docs/providers/aws/guide/packaging/
      // for more information
      const artifactPath = path.join("target/lambda/release", binary + ".zip");
      func.package = func.package || {};
      func.package.artifact = artifactPath;

      // Ensure the runtime is set to a sane value for other plugins
      if (func.runtime == RUST_RUNTIME) {
        func.runtime = BASE_RUNTIME;
      }
    });
    if (service.provider.runtime === RUST_RUNTIME) {
      service.provider.runtime = BASE_RUNTIME;
    }
    if (!rustFunctionsFound) {
      throw new Error(
        `Error: no Rust functions found. ` +
          `Use 'runtime: ${RUST_RUNTIME}' in global or ` +
          `function configuration to use this plugin.`
      );
    }
  }
}

module.exports = RustPlugin;
