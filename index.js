"use strict";

// https://serverless.com/blog/writing-serverless-plugins/
// https://serverless.com/framework/docs/providers/aws/guide/plugins/
// https://github.com/softprops/lambda-rust/

const { spawnSync } = require("child_process");
const { homedir, platform } = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { mkdirSync, writeFileSync, readFileSync } = require("fs");

const DEFAULT_DOCKER_TAG = "latest";
const DEFAULT_DOCKER_IMAGE = "softprops/lambda-rust";
const RUST_RUNTIME = "rust";
const BASE_RUNTIME = "provided.al2";
const NO_OUTPUT_CAPTURE = { stdio: ["ignore", process.stdout, process.stderr] };
const MUSL_PLATFORMS = ["darwin", "win32", "linux"];

function includeInvokeHook(serverlessVersion) {
  let [major, minor] = serverlessVersion.split(".");
  let majorVersion = parseInt(major);
  let minorVersion = parseInt(minor);
  return majorVersion === 1 && minorVersion >= 38 && minorVersion < 40;
}

/** assumes docker is on the host's execution path for containerized builds
 *  assumes cargo is on the host's execution path for local builds
 */
class RustPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.servicePath = this.serverless.config.servicePath || "";
    this.hooks = {
      "before:package:createDeploymentArtifacts": this.build.bind(this),
      "before:deploy:function:packageFunction": this.build.bind(this),
      "before:offline:start": this.build.bind(this),
      "before:offline:start:init": this.build.bind(this),
    };
    if (includeInvokeHook(serverless.version)) {
      this.hooks["before:invoke:local:invoke"] = this.build.bind(this);
    }
    this.custom = Object.assign(
      {
        cargoFlags: "",
        dockerTag: DEFAULT_DOCKER_TAG,
        dockerImage: DEFAULT_DOCKER_IMAGE,
        dockerless: false,
        strictMode: true,
      },
      (this.serverless.service.custom && this.serverless.service.custom.rust) ||
        {}
    );

    // Docker can't access resources outside of the current build directory.
    // This poses a problem if the serverless yaml is inside a workspace,
    // and we want pull in other packages from the workspace
    this.srcPath = path.resolve(this.custom.dockerPath || this.servicePath);

    // By default, Serverless examines node_modules to figure out which
    // packages there are from dependencies versus devDependencies of a
    // package. While there will always be a node_modules due to Serverless
    // and this plugin being installed, it will be excluded anyway.
    // Therefore, the filtering can be disabled to speed up (~3.2s) the process.
    this.serverless.service.package.excludeDevDependencies = false;
  }

  localBuildArgs(funcArgs, cargoPackage, binary, profile, platform) {
    const defaultArgs = ["build", "-p", cargoPackage];
    const profileArgs = profile !== "dev" ? ["--release"] : [];
    const cargoFlags = (
      (funcArgs || {}).cargoFlags ||
      this.custom.cargoFlags ||
      ""
    ).split(/\s+/);

    let target = (funcArgs || {}).target || this.custom.target;

    const targetArgs = target
      ? ["--target", target]
      : MUSL_PLATFORMS.includes(platform)
      ? ["--target", "x86_64-unknown-linux-musl"]
      : [];
    return [
      ...defaultArgs,
      ...profileArgs,
      ...targetArgs,
      ...cargoFlags,
    ].filter((i) => i);
  }

  localBuildEnv(funcArgs, env, platform) {
    const defaultEnv = { ...env };

    let target = (funcArgs || {}).target || this.custom.target;
    let linker = (funcArgs || {}).linker || this.custom.linker;

    const platformEnv = linker
      ? {
          RUSTFLAGS: (env["RUSTFLAGS"] || "") + ` -Clinker=${linker}`,
          TARGET_CC: linker,
          [`CC_${target || "x86_64_unknown_linux_musl"}`]: linker,
        }
      : "win32" === platform
      ? {
          RUSTFLAGS: (env["RUSTFLAGS"] || "") + " -Clinker=rust-lld",
          TARGET_CC: "rust-lld",
          CC_x86_64_unknown_linux_musl: "rust-lld",
        }
      : "darwin" === platform
      ? {
          RUSTFLAGS:
            (env["RUSTFLAGS"] || "") + " -Clinker=x86_64-linux-musl-gcc",
          TARGET_CC: "x86_64-linux-musl-gcc",
          CC_x86_64_unknown_linux_musl: "x86_64-linux-musl-gcc",
        }
      : {};
    return {
      ...defaultEnv,
      ...platformEnv,
    };
  }

  localSourceDir(funcArgs, profile, platform) {
    let executable = "target";
    if (MUSL_PLATFORMS.includes(platform)) {
      let target = (funcArgs || {}).target || this.custom.target;
      executable = path.join(
        executable,
        target ? target : "x86_64-unknown-linux-musl"
      );
    }
    return path.join(executable, profile !== "dev" ? "release" : "debug");
  }

  localArtifactDir(profile) {
    return path.join(
      "target",
      "lambda",
      profile !== "dev" ? "release" : "debug"
    );
  }

  localBuild(funcArgs, cargoPackage, binary, profile) {
    const args = this.localBuildArgs(
      funcArgs,
      cargoPackage,
      binary,
      profile,
      platform()
    );

    const env = this.localBuildEnv(funcArgs, process.env, platform());
    this.serverless.cli.log(`Running local cargo build on ${platform()}`);

    const buildResult = spawnSync("cargo", args, {
      ...NO_OUTPUT_CAPTURE,
      ...{
        env: env,
      },
    });
    if (buildResult.error || buildResult.status > 0) {
      return buildResult;
    }
    // now rename binary and zip
    const sourceDir = this.localSourceDir(funcArgs, profile, platform());
    const zip = new AdmZip();
    zip.addFile(
      "bootstrap",
      readFileSync(path.join(sourceDir, binary)),
      "",
      0o755
    );
    const targetDir = this.localArtifactDir(profile);
    try {
      mkdirSync(targetDir, { recursive: true });
    } catch {}
    try {
      writeFileSync(path.join(targetDir, `${binary}.zip`), zip.toBuffer());
      return {};
    } catch (err) {
      this.serverless.cli.log(`Error zipping artifact ${err}`);
      return {
        err: err,
        status: 1,
      };
    }
  }

  dockerBuildArgs(
    funcArgs,
    cargoPackage,
    binary,
    profile,
    srcPath,
    cargoRegistry,
    cargoDownloads,
    env
  ) {
    const defaultArgs = [
      "run",
      "--rm",
      "-t",
      "-e",
      `BIN=${binary}`,
      `-v`,
      `${srcPath}:/code`,
      `-v`,
      `${cargoRegistry}:/cargo/registry`,
      `-v`,
      `${cargoDownloads}:/cargo/git`,
    ];
    const customArgs = (env["SLS_DOCKER_ARGS"] || "").split(" ") || [];
    let cargoFlags = (funcArgs || {}).cargoFlags || this.custom.cargoFlags;
    if (profile) {
      // release or dev
      customArgs.push("-e", `PROFILE=${profile}`);
    }
    if (cargoPackage != undefined) {
      if (cargoFlags) {
        cargoFlags = `${cargoFlags} -p ${cargoPackage}`;
      } else {
        cargoFlags = ` -p ${cargoPackage}`;
      }
    }
    if (cargoFlags) {
      // --features awesome-feature, ect
      customArgs.push("-e", `CARGO_FLAGS=${cargoFlags}`);
    }
    const dockerTag = (funcArgs || {}).dockerTag || this.custom.dockerTag;
    const dockerImage = (funcArgs || {}).dockerImage || this.custom.dockerImage;

    return [
      ...defaultArgs,
      ...customArgs,
      `${dockerImage}:${dockerTag}`,
    ].filter((i) => i);
  }

  dockerBuild(funcArgs, cargoPackage, binary, profile) {
    const cargoHome = process.env.CARGO_HOME || path.join(homedir(), ".cargo");
    const cargoRegistry = path.join(cargoHome, "registry");
    const cargoDownloads = path.join(cargoHome, "git");

    const dockerCLI = process.env["SLS_DOCKER_CLI"] || "docker";
    const args = this.dockerBuildArgs(
      funcArgs,
      cargoPackage,
      binary,
      profile,
      this.srcPath,
      cargoRegistry,
      cargoDownloads,
      process.env
    );

    this.serverless.cli.log("Running containerized build");

    return spawnSync(dockerCLI, args, NO_OUTPUT_CAPTURE);
  }

  functions() {
    if (this.options.function) {
      return [this.options.function];
    } else {
      return this.serverless.service.getAllFunctions();
    }
  }

  cargoBinary(func) {
    let [cargoPackage, binary] = func.handler.split(".");
    if (binary == undefined) {
      binary = cargoPackage;
    }
    return { cargoPackage, binary };
  }

  buildLocally(func) {
    return (func.rust || {}).dockerless || this.custom.dockerless;
  }

  /** the entry point for building functions */
  build() {
    const strictMode = this.custom.strictMode !== false;
    const service = this.serverless.service;
    if (service.provider.name != "aws") {
      return;
    }
    let rustFunctionsFound = false;
    this.functions().forEach((funcName) => {
      const func = service.getFunction(funcName);
      const runtime = func.runtime || service.provider.runtime;

      func.tags = func.tags || {};
      if (!(runtime === RUST_RUNTIME || func.tags.language === "rust")) {
        // skip functions which don't apply to rust
        return;
      }
      rustFunctionsFound = true;

      func.package = func.package || {};
      if (func.package.artifact && func.package.artifact !== "") {
        this.serverless.cli.log(
          `Artifact defined for ${func.handler}, skipping build...`
        );
      } else {
        const { cargoPackage, binary } = this.cargoBinary(func);

        this.serverless.cli.log(`Building Rust ${func.handler} func...`);
        let profile = (func.rust || {}).profile || this.custom.profile;

        const res = this.buildLocally(func)
          ? this.localBuild(func.rust, cargoPackage, binary, profile)
          : this.dockerBuild(func.rust, cargoPackage, binary, profile);
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
        // To avoid artifact naming conflicts when we potentially have more than one function
        // we leverage the ability to declare a package artifact directly
        // see https://serverless.com/framework/docs/providers/aws/guide/packaging/
        // for more information
        const artifactPath = path.join(
          this.srcPath,
          `target/lambda/${"dev" === profile ? "debug" : "release"}`,
          `${binary}.zip`
        );
        func.package = func.package || {};
        func.package.artifact = artifactPath;

        // Ensure the runtime is set to a sane value for other plugins
        if (func.runtime == RUST_RUNTIME) {
          func.runtime = BASE_RUNTIME;
        }
      }
    });
    if (service.provider.runtime === RUST_RUNTIME) {
      service.provider.runtime = BASE_RUNTIME;
    }
    if (!rustFunctionsFound && strictMode) {
      throw new Error(
        `Error: no Rust functions found. ` +
          `Use 'runtime: ${RUST_RUNTIME}' in global or ` +
          `function configuration to use this plugin.`
      );
    }
  }
}

module.exports = RustPlugin;
