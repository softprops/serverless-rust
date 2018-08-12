'use strict';

// https://serverless.com/blog/writing-serverless-plugins/
// https://serverless.com/framework/docs/providers/aws/guide/plugins/

const { spawnSync } = require('child_process');
const { removeSync } = require('fs-extra');
const copyFileSync = require('fs-copy-file-sync')
const path = require('path');

const NO_OUTPUT_CAPTURE = { stdio: ['ignore', process.stdout, process.stderr] };

/** assumes docker is on the host's execution path */
class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.servicePath = this.serverless.config.servicePath || '';
    this.hooks = {
      'before:package:createDeploymentArtifacts': this.build.bind(this),
      'after:package:createDeploymentArtifacts': this.clean.bind(this),
    };
    this.custom = Object.assign(
      {
        cargoFlags: "",
        dockerTag: "0.1.0-rust-1.28.0"
      },
      this.serverless.service.custom && this.serverless.service.custom.rust || {}
    );

    // By default, Serverless examines node_modules to figure out which
    // packages there are from dependencies versus devDependencies of a
    // package. While there will always be a node_modules due to Serverless
    // and this plugin being installed, it will be excluded anyway.
    // Therefore, the filtering can be disabled to speed up (~3.2s) the process.
    this.serverless.service.package.excludeDevDependencies = false;

    // represented as an object for unique keys
    this.artifacts = {};
  }

  runDocker(funcArgs, captureOutput) {
    const defaultArgs = [
      'run',
      '--rm',
      '-t',
      `-v`, `${this.servicePath}:/code`,
      `-v`, `${process.env['HOME']}/.cargo/registry:/root/.cargo/registry`,
      `-v`, `${process.env['HOME']}/.cargo/git:/root/.cargo/git`,
    ];
    const customArgs = [];
    const cargoFlags = (funcArgs || {}).cargoFlags || this.custom.cargoFlags;
    if (cargoFlags) {
      // --features python3-sys, ect
      customArgs.push('-e', `CARGO_FLAGS=${cargoFlags}`);
    };
    const dockerTag = (funcArgs || {}).dockerTag || this.custom.dockerTag;
    return spawnSync(
      'docker',
      [
        ...defaultArgs,
        ...customArgs,
        `softprops/lambda-rust:${dockerTag}`
      ],
      captureOutput ? {} : NO_OUTPUT_CAPTURE
    );
  }

  build() {
    const service = this.serverless.service;
    service.getAllFunctions().forEach(funcName => {
      const func = service.getFunction(funcName);
      const [crate, fn] = func.handler.split('.');
      this.serverless.cli.log(`Building native Rust ${func.handler} func...`);
      const res = this.runDocker(func.rust);
      if (res.error || res.status > 0) {
        this.serverless.cli.log(`Dockerized Rust build encountered an error.`);
        throw new Error(res.error);
      }
      const executablePath = path.resolve('target/lambda/release', crate + '.so');
      const targetPath = path.resolve(this.servicePath, crate + '.so');
      copyFileSync(executablePath, targetPath);
      // only the keys matters
      this.artifacts[targetPath] = null;
    })
  }

  clean() {
    Object.keys(this.artifacts).forEach(removeSync);
  }
}

module.exports = ServerlessPlugin;