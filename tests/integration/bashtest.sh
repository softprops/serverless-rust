#!/usr/bin/env bash

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
        echo -e "👎  ${RED} ${MESSAGE}: fail${NC}"
        ((++FAILED))
    fi
}

function end_tests() {
    if ((FAILED > 0))
    then
        echo
        echo -e "💀  ${RED} Ran ${TESTS} tests, ${FAILED} failed.${NC}"
        exit $FAILED
    else
        echo
        echo -e "👌  ${GREEN} ${TESTS} tests passed.${NC}"
        exit 0
    fi
}