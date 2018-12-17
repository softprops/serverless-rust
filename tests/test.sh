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
        echo -e "${RED}Run ${TESTS} tests, ${FAILED} failed.${NC}"
        exit $FAILED
    else
        echo -e "${GREEN}${TESTS} tests passed.${NC}"
        exit 0
    fi
}

# Directory of the integration test
HERE=$(dirname $0)
# Root directory of the repository
DIST=$(cd $HERE/..; echo $PWD)

cd ${HERE}/test-func

# install build deps
npm install serverless --silent
assert_success "it installs" npm install $DIST --silent

# integration test `package` command
assert_success "it packages" npx serverless package

# verify packaged artifact by invoking it using the lambdaci "provided" docker image
unzip -o  \
    target/lambda/release/test-func.zip \
    -d /tmp/lambda > /dev/null 2>&1 && \
  docker run \
    -i -e DOCKER_LAMBDA_USE_STDIN=1 \
    --rm \
    -v /tmp/lambda:/var/task \
    lambci/lambda:provided < test-event.json | grep -v RequestId | grep -v '^\W*$' > test-out.log

cat test-out.log

end_tests