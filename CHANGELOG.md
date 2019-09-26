# ⚡ 0.3.7

bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.2-rust-1.37.0 to gain [new rust 1.37.0 features](https://blog.rust-lang.org/2019/08/15/Rust-1.37.0.html)

# ⚡ 0.3.6

*  bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.36.0 to gain [new rust 1.36.0 features](https://blog.rust-lang.org/2019/07/04/Rust-1.36.0.html).

# ⚡ 0.3.5

*  bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.35.0 to gain [new rust 1.35.0 features](https://blog.rust-lang.org/2019/05/23/Rust-1.35.0.html).

# ⚡ 0.3.4

- fix a `npx serverless invoke local` for versions of serverless framework `1.40.*` which now emits `package` events  within `invokeLocal` events. [#38](https://github.com/softprops/serverless-rust/pull/38)
- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.34.1 to gain [new rust 1.34.1 features](https://blog.rust-lang.org/2019/04/25/Rust-1.34.1.html).
- use `os.homedir()` instead of `process.env['HOME']` for improved portability

# ⚡ 0.3.3

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.34.0 to gain [new rust 1.34.0 features](https://blog.rust-lang.org/2019/04/11/Rust-1.34.0.html).

# ⚡ 0.3.2

- ✨new support for invoking your lambdas locally.

This decreases the turn around time to validate a change before
without having to deploy it first

```sh
$ npx serverless invoke local -f foo -d '{"yes":"we can"}'
```

You can still use this plugin with older versions of serverless but `invoke local` will only work with `serverless@1.39.1` and above

# ⚡ 0.3.1

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.33.0

# ⚡ 0.3.0

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.1-rust-1.32.0, fixing a bug where cargo binaries named `bootstrap` weren't getting packaged. Reminder: this plugin renames binaries to `bootstrap` for the lambda runtime for you. You don't have do to this manually in your Cargo configuration. This also introduces an efficiency in the way binaries are identified for packaging that may help some windows users.
- bump serverless version to [`1.37.1`](https://github.com/serverless/serverless/releases/tag/v1.37.1)


# ⚡ 0.2.1

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.2.0-rust-1.32.0, to make the new default Rust 1.32.0 (the latest release of Rust at this time)
- bump serverless version to [`1.36.3`](https://github.com/serverless/serverless/releases/tag/v1.36.3)

# ⚡ 0.2.0

- Switch from supporting the Lambda `python3.6` runtime to a new ✨ `rust` runtime ✨ ( which runs on the `provided` runtime under the covers )
- you can now deploy independent functions with `npx serverless deploy function -f func-name`
- you no longer have to be explicit about function binary to include, this plugin generates and configures the artifact (zip) file for you
- you no longer have to set default exclusion rules
- you can deploy a `rust` runtime function side by side with other serverless runtime functions
  within the same service, to facilitate experimentation and learning.

# ⚡ 0.1.7

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.30.1, to make the new default Rust 1.30.1 (the latest release of Rust at this time)
- bump serverless version to [1.33.2](https://github.com/serverless/serverless/blob/master/CHANGELOG.md#1332-18112018) ( the latest serverless release at this time)

# ⚡ 0.1.6

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.28.0, to make the new default Rust 1.28.0 (the latest release of Rust at this time)

# ⚡ 0.1.5

- ensure only a unique set of artifacts are collected for cleanup
- Allocate a docker pseudo-tty so that process signals are forwarded (Keyboard interrupts stop docker process)

# ⚡ 0.1.4

- bump [lambda-rust](https://hub.docker.com/r/softprops/lambda-rust/) docker version to 0.1.0-rust-1.27.2, to make the new default Rust 1.27.2 (the latest release of Rust at this time)
- speed up deployments by ~3.2 seconds by disabling excludeDevDependencies. it's on by default but it's not useful for for Rust focused services
- the `custom.rust` config object can be overridden at the function level

```yaml
functions:
  hello:
    rust:
      cargoFlags: "--features ..."
    handler: liblambda.handler
    package:
      include:
        - liblambda.so
    events:
      - schedule: rate(5 minutes)
```

# ⚡ 0.1.3

- bump lambda rust docker version to 0.1.0-rust-1.27.0

# ⚡ 0.1.2

- bump lambda rust docker version to 0.1.0-rust-1.26.2
- use a polyfill for fs.copyFileSync to accommodate older versions of node on travis ci

# ⚡ 0.1.1

- fix exporting plugin

# ⚡ 0.1.0

- initial release
