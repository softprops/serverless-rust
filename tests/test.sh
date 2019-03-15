#!/bin/bash

# decor
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# test state
TESTS=0
FAILED=0

# Verify that a command succeeds
function assert_success() {
    MESSAGE="$1"
    shift
    COMMAND="$@"

    ((++TESTS))

    if $COMMAND
    then
        echo -e "👍  ${GREEN} $MESSAGE: success${NC}"
    else
        echo -e "👎  ${RED}${MESSAGE}: fail${NC}"
        ((++FAILED))
    fi
}

function end_tests() {
    if ((FAILED > 0))
    then
        echo
        echo -e "💀  ${RED}Run ${TESTS} tests, ${FAILED} failed.${NC}"
        exit $FAILED
    else
        echo
        echo -e "👌  ${GREEN}${TESTS} tests passed.${NC}"
        exit 0
    fi
}

# Directory of the integration test
HERE=$(dirname $0)
# Root directory of the repository
DIST=$(cd $HERE/..; echo $PWD)

cd ${HERE}/test-func

# install build deps
assert_success "it installs with npm" \
    npm i -D $DIST --silent

# integration test `package` command
assert_success "it packages with serverless" \
    npx serverless package

# verify packaged artifact by invoking it using the lambdaci "provided" docker image
unzip -o  \
    target/lambda/release/test-func.zip \
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
     | grep -v " release " \
     | grep -v "adding: bootstrap" \
     > local-out.log)

assert_success "when serverless invokes locally, it produces expected output" \
    diff test-local.json local-out.log

#rm test-out.log

end_tests