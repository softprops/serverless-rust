#!/usr/bin/env bash

# Directory of the integration test
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
# Root directory of the repository
DIST=$(cd $HERE/..; pwd)
export SILENT=1

source "${HERE}"/bashtest.sh

for project in  test-func test-func-dev; do

    cd "${HERE}"/"${project}"
    echo "👩‍🔬 Running tests for $project"

    if [[ "${project}" == "test-func" ]]; then
        target=release
    else
        target=debug
    fi

    # install build deps
    assert_success "it installs with npm" \
        npm i -D "$DIST" --silent

    # integration test `package` command
    assert_success "it packages with serverless" \
        npx serverless package

    # verify packaged artifact by invoking it using the lambdaci "provided" docker image
    unzip -o  \
        target/lambda/"${target}"/test-func.zip \
        -d /tmp/lambda > /dev/null 2>&1 && \
    docker run \
        -i --rm \
        -e DOCKER_LAMBDA_USE_STDIN=1 \
        -v /tmp/lambda:/var/task \
        lambci/lambda:provided \
        < test-event.json \
        | grep -v RequestId \
        | grep -v '^\W*$' \
        > test-out.log

    assert_success "when invoked, it produces expected output" \
        diff test-event.json test-out.log

    # integration test local invocation
    assert_success "it supports serverless local invocation" \
        $(npx serverless invoke local -f hello -d '{"baz":"boom"}' \
        | grep -v Serverless \
        | grep -v RequestId \
        | grep -v '^\W*$' \
        | grep -v "release " \
        | grep -v "unoptimized " \
        | grep -v "adding: bootstrap" \
        | grep -v "objcopy:" \
        > local-out.log)

    assert_success "when serverless invokes locally, it produces expected output" \
        diff test-local.json local-out.log
done

end_tests