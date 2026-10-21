#!/usr/bin/env bash
set -Eeuo pipefail
[[ $# == 2 ]] || { echo 'usage: run-wp-fixture.sh IMAGE EVIDENCE_DIR' >&2; exit 2; }
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_ENVIRONMENT:-} == github-hosted && ${RUNNER_OS:-} == Linux ]] || {
  echo 'Fresh GitHub-hosted Linux runner required' >&2; exit 2;
}
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
exec timeout --signal=TERM --kill-after=20s 470s python3 "$HERE/run_fixture.py" "$1" "$2"
