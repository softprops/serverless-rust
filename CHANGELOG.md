# ⚡ 0.1.7

* bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.30.1, to make the new default Rust 1.30.1 (the latest release of Rust at this time)
* bumb serverless version to [1.33.2](https://github.com/serverless/serverless/blob/master/CHANGELOG.md#1332-18112018) ( the latest serverless release at this time)

# ⚡ 0.1.6

* bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.28.0, to make the new default Rust 1.28.0 (the latest release of Rust at this time)

# ⚡ 0.1.5

* ensure only a unique set of artifacts are collected for cleanup
* Allocate a docker pseudo-tty so that process signals are forwarded (Keyboard interrupts stop docker process)

# ⚡ 0.1.4

* bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.27.2, to make the new default Rust 1.27.2 (the latest release of Rust at this time)
* speed up deployments by ~3.2 seconds by disabling excludeDevDependencies. it's on by default but it's not useful for for Rust focused services
* the `custom.rust` config object can be overrided at the function level

```yaml
functions:
  hello:
    rust:
      cargoFlags: '--features ...'
    handler: liblambda.handler
    package:
      include:
        - liblambda.so
    events:
      - schedule: rate(5 minutes)
```

# ⚡ 0.1.3

* bump lambda rust docker version to 0.1.0-rust-1.27.0

# ⚡ 0.1.2

* bump lambda rust docker version to 0.1.0-rust-1.26.2
* use a polyfill for fs.copyFileSync to accomidate older versions of node on travis ci

# ⚡ 0.1.1

* fix exporting plugin

# ⚡ 0.1.0

* initial release