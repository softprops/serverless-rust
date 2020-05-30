const assert = require("assert");
const RustPlugin = require("../../index.js");

describe("RustPlugin", () => {
  it("sets sensible defaults", () => {
    const plugin = new RustPlugin(
      { version: "1.71.3", service: { package: {} }, config: {} },
      {}
    );
    assert.deepEqual(plugin.custom, {
      cargoFlags: "",
      dockerImage: "softprops/lambda-rust",
      dockerTag: "0.2.7-rust-1.43.0",
      dockerless: false,
    });
  });

  it("uses services.custom.rust for default overrides", () => {
    const plugin = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );
    assert.deepEqual(plugin.custom, {
      cargoFlags: "--features foo",
      dockerImage: "notsoftprops/lambda-rust",
      dockerTag: "latest",
      dockerless: true,
    });
  });

  it("resolves cargoBinary from handler name", () => {
    const plugin = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );
    assert.deepEqual(plugin.cargoBinary({ handler: "foo" }), {
      cargoPackage: "foo",
      binary: "foo",
    });

    assert.deepEqual(plugin.cargoBinary({ handler: "foo.bar" }), {
      cargoPackage: "foo",
      binary: "bar",
    });
  });

  it("configures expected localBuildArgs", () => {
    const plugin = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );

    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "linux"),
      ["build", "-p", "foo", "--release", "--features", "foo"],
      "failed on linux"
    );
    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "darwin"),
      [
        "build",
        "-p",
        "foo",
        "--release",
        "--target",
        "x86_64-unknown-linux-musl",
        "--features",
        "foo",
      ],
      "failed on osx"
    );
    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "windows"),
      [
        "build",
        "-p",
        "foo",
        "--release",
        "--target",
        "x86_64-unknown-linux-musl",
        "--features",
        "foo",
      ],
      "failed on windows"
    );
  });

  it("builds locally under expected conditions", () => {
    const plugin = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );
    assert(plugin.buildLocally({}));

    assert(plugin.buildLocally({ rust: { dockerless: true } }));
  });
});
