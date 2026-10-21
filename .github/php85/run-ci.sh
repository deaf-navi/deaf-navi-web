#!/usr/bin/env bash
# GitHub-hosted runner only. No credentials, environments or production mounts.
set -euo pipefail
: "${RUNNER_TEMP:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_REF:?}"
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
if [[ "$GITHUB_REF" != refs/heads/* || "$GITHUB_REF" == 'refs/heads/main' ]]; then
  printf '%s\n' 'Run this isolated check from the reviewed validation branch.' >&2
  exit 2
fi
readonly name="php85-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
readonly builder="${name}-builder"
readonly container="${name}-test"
readonly image="deafnavi-php85-ci:${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
readonly evidence="${RUNNER_TEMP}/php85-evidence"
readonly source_dir="${RUNNER_TEMP}/${name}-source"
readonly source_tar="${RUNNER_TEMP}/${name}-source.tar"
readonly buildkit='moby/buildkit:buildx-stable-1@sha256:98cc6a3fc46220d00f8224ae483f3274fc874e9be8d7dd1e2e2c5481209228b5'

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker buildx rm "$builder" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
mkdir -p "$evidence"
# Only this fresh evidence directory is writable to the non-root container.
chmod 0777 "$evidence"
mkdir "$source_dir"
chmod 0755 "$source_dir"
python3 .github/php85/prepare-input.py "$source_tar" "$evidence"
tar -xf "$source_tar" -C "$source_dir"
cp .github/php85/upstream-evidence.json "$evidence/upstream-evidence.json"

# Limit the builder itself as well as make -j2 inside it. Do not publish an image.
docker buildx create --name "$builder" --driver docker-container \
  --driver-opt "image=${buildkit},memory=4g,memory-swap=4g,cpu-quota=200000,cpu-period=100000,restart-policy=no"
timeout --signal=TERM --kill-after=15s 20m docker buildx build \
  --builder "$builder" --platform linux/amd64 --load --pull --provenance=false \
  --progress=plain --tag "$image" .github/php85 2>&1 | tee "$evidence/php-build.log"
docker image inspect "$image" --format '{{.Id}}' > "$evidence/image-id.txt"

# Only committed files and a fresh evidence directory enter the container.
# No ports, Docker socket, host environment, credentials or production data.
set +e
timeout --signal=TERM --kill-after=15s 8m docker run --rm --init \
  --name "$container" --platform linux/amd64 --network none --read-only \
  --cpus 2 --memory 3g --memory-swap 3g --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges=true \
  --ulimit nofile=1024:1024 \
  --mount "type=bind,source=${source_dir},target=/workspace,readonly" \
  --mount "type=bind,source=${evidence},target=/evidence" \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=1g,mode=1777 \
  "$image" 2>&1 | tee "$evidence/runtime.log"

deaf_result=$?
set -e

# Separate synthetic WordPress check, even if an application regression failed.
set +e
bash .github/php85/wp/run-wp-fixture.sh "$image" "$evidence/wordpress"
wordpress_result=$?
set -e
if (( deaf_result != 0 || wordpress_result != 0 )); then
  exit 1
fi
