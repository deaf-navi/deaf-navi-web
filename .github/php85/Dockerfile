# CI-only PHP CLI build. No application code or credentials enter build stages.
FROM node:22.23.4-bookworm-slim@sha256:ea11b74b986d520137cdef9a5346e447a00f275ecc4abc0055b7151226231e09 AS node

FROM debian:bookworm-slim@sha256:ec31d744f83f4a73447ba045aaab9409997efe5cc706eca4890c1be36cc1606a AS php-build
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN apt-get update -o APT::Update::Error-Mode=any \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils build-essential pkg-config \
      libargon2-dev libcurl4-openssl-dev libfreetype6-dev libicu-dev \
      libjpeg62-turbo-dev libonig-dev libpng-dev libsqlite3-dev \
      libssl-dev libwebp-dev libxml2-dev libzip-dev zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*
COPY build-php.sh /opt/php85/build-php.sh
RUN bash /opt/php85/build-php.sh

FROM debian:bookworm-slim@sha256:ec31d744f83f4a73447ba045aaab9409997efe5cc706eca4890c1be36cc1606a
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]
RUN apt-get update -o APT::Update::Error-Mode=any \
 && apt-get install -y --no-install-recommends \
      ca-certificates python3 libargon2-1 libcurl4 libfreetype6 libicu72 \
      libjpeg62-turbo libonig5 libpng16-16 libsqlite3-0 libssl3 \
      libstdc++6 libwebp7 libxml2 libzip4 zlib1g \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 tester \
 && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /tmp/home tester
COPY --from=php-build /opt/php85 /opt/php85
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY run-checks.py /opt/php85/run-checks.py
ENV PATH="/opt/php85/bin:/usr/local/bin:/usr/bin:/bin" \
    HOME="/tmp/home" TMPDIR="/tmp" PYTHONDONTWRITEBYTECODE="1" \
    DEAFNAVI_LOCAL_TEST="1" DEAFNAVI_DATA_DIR="/tmp/default-directory" \
    DEAFNAVI_VISITOR_DIR="/tmp/default-visitors" \
    DEAFNAVI_ACCESS_LOG_DIR="/tmp/default-access-logs"
RUN php -r 'if (PHP_VERSION !== "8.5.12" || PHP_SAPI !== "cli") { exit(1); } foreach (["gd","sqlite3","pdo_sqlite","mbstring","curl","mysqli","pdo_mysql","openssl","zlib","intl","zip","session","fileinfo","dom"] as $x) { if (!extension_loaded($x)) { fwrite(STDERR,"Missing extension: $x\n"); exit(1); } }' \
 && php -r 'if ((gd_info()["WebP Support"] ?? false) !== true) { fwrite(STDERR,"GD WebP support required\n"); exit(1); }' \
 && php -n -r 'exit(function_exists("mb_strlen") ? 1 : 0);' \
 && test "$(node --version)" = "v22.23.4" \
 && python3 -c 'import sqlite3; print(sqlite3.sqlite_version)' \
 && dpkg-query -W -f='${binary:Package}\t${Version}\n' > /opt/php85/evidence/runtime-packages.txt
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["python3", "/opt/php85/run-checks.py"]
