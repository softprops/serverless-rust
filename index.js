'use strict';

// https://serverless.com/blog/writing-serverless-plugins/

const { spawnSync } = require('child_process');
const fs = require('fs-extra');
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
      },
      this.serverless.service.custom && this.serverless.service.custom.rust || {}
    );
    this.artifacts = [];
  }

  runDocker(args, captureOutput) {
    const defaultArgs = [
      'run',
      '--rm',
      `-v`, `${this.servicePath}:/code`,
      `-v`, `${process.env['HOME']}/.cargo/registry:/root/.cargo/registry`,
      `-v`, `${process.env['HOME']}/.cargo/git:/root/.cargo/git`,
    ];
    const customArgs = [];
    if (this.custom.cargoFlags) {
      // --features python3-sys, ect
      customArgs.push('-e', `CARGO_FLAGS=${this.custom.cargoFlags}`);
    };
    return spawnSync(
      'docker',
      [
        ...defaultArgs,
        ...customArgs,
        'dougtangren/rust-crowbar'
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
      const res = this.runDocker();
      if (res.error || res.status > 0) {
        this.serverless.cli.log(`Dockerized Rust build encountered an error.`);
        throw new Error(res.error);
      }
      const executablePath = path.resolve('target/lambda/release', crate + '.so');
      const targetPath = path.resolve(this.servicePath, crate + '.so');
      fs.copyFileSync(executablePath, targetPath);
      this.artifacts.push(targetPath);
    })
  }

  clean() {
    this.artifacts.forEach(fs.removeSync);
  }
}
