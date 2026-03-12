#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./test.sh [--all] [--scenario <path>] [--path <path>] [--create <policy.xml>]

Examples:
  ./test.sh --all
  ./test.sh --scenario "normalize-request/numero da conta no query param"
  ./test.sh --path "normalize-error/uses code as error type"
  ./test.sh --create "JS-Something.xml"
USAGE
}

if [[ $# -eq 0 ]]; then
  node tests/run-scenario.js --all
  exit $?
fi

case "$1" in
  --all)
    node tests/run-scenario.js --all
    ;;
  --scenario|--path)
    if [[ $# -lt 2 ]]; then
      echo "Error: $1 requires a scenario path" >&2
      usage
      exit 1
    fi

    node tests/run-scenario.js "$1" "$2"
    ;;
  --create)
    if [[ $# -lt 2 ]]; then
      echo "Error: --create requires a policy XML filename" >&2
      usage
      exit 1
    fi

    node tests/create-scenario.js "$2"
    ;;
  --help|-h)
    usage
    ;;
  *)
    node tests/run-scenario.js "$1"
    ;;
esac
