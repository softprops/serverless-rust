# serverless rust [![Build Status](https://travis-ci.org/softprops/serverless-rust.svg?branch=master)](https://travis-ci.org/softprops/serverless-rust)

> A ⚡ [Serverless framework](https://serverless.com/framework/) ⚡ plugin for [Rustlang](https://www.rust-lang.org/en-US/) applications 🦀

## 📦 Install

💡 This plugin assumes you are building Rustlang lambdas using the [lando](https://github.com/softprops/lando) or [crowbar](https://github.com/ilianaw/rust-crowbar) crates.

Add the following to your serverless project's `serverless.yaml` file

```yaml
service: demo
provider:
  name: aws
  # crowbar and lando integrate with aws lambda's python3.6 runtime
  runtime: python3.6
plugins:
  # this adds informs servleress to use
  # the serverless-rust plugin
  - serverless-rust
custom:
  # this section customizes the default
  # serverless-rust plugin settings
  rust:
    cargoFlags: '--features python3-sys'
# the follow is recommended for small deployment sizes
# (faster uploads)
package:
  individually: true
  exclude:
    - ./**
functions:
  test:
    # liblambda.handler is the default function name when
    # you follow lando/crowbar conventions
    handler: liblamda.handler
    # the following limits the function packaging
    # to just the resulting binary
    package:
      include:
        - liblambda.so
    events:
      - http:
          path: /test
          method: GET

```