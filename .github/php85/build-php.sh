#!/usr/bin/env bash
set -euo pipefail

readonly version='8.5.12'
readonly source_sha='08bc2eba2a588654ade1357174aa646b761556c862dda0678345ee29ed481209'
readonly source_url="https://www.php.net/distributions/php-${version}.tar.xz"
mkdir -p /opt/php85/evidence /opt/php85/etc/conf.d /usr/src/php
cd /usr/src/php
curl --fail --show-error --silent --proto '=https' --tlsv1.2 \
  --connect-timeout 20 --max-time 180 --retry 2 \
  --max-filesize 20971520 "$source_url" -o php.tar.xz
printf '%s  php.tar.xz\n' "$source_sha" | sha256sum --check --strict
printf '%s  %s\n' "$source_sha" "$source_url" > /opt/php85/evidence/source.sha256
tar -xJf php.tar.xz --strip-components=1

export CFLAGS='-O2 -fstack-protector-strong -fpic -fpie'
export CPPFLAGS="$CFLAGS"
export LDFLAGS='-Wl,-O1 -pie'
configure_args=(
  --prefix=/opt/php85
  --with-config-file-path=/opt/php85/etc
  --with-config-file-scan-dir=/opt/php85/etc/conf.d
  --enable-option-checking=fatal
  --enable-cli --disable-cgi --disable-fpm --disable-phpdbg --without-pear
  --with-openssl --with-zlib --with-curl
  --with-password-argon2
  --with-sqlite3=/usr --with-pdo-sqlite=/usr
  --with-mysqli=mysqlnd --with-pdo-mysql=mysqlnd
  --enable-mbstring=shared
  --enable-gd=shared --with-jpeg --with-freetype --with-webp
  --enable-intl=shared --with-zip=shared
)
printf '%s\n' "${configure_args[@]}" > /opt/php85/evidence/configure-options.txt
./configure "${configure_args[@]}"
make -j2
make install

cat > /opt/php85/etc/php.ini <<'INI'
extension=mbstring
extension=gd
extension=intl
extension=zip
error_reporting=E_ALL
display_errors=stderr
display_startup_errors=On
log_errors=On
error_log=/tmp/php-errors.log
date.timezone=UTC
memory_limit=512M
session.save_path=/tmp
INI
/opt/php85/bin/php -r 'if (PHP_VERSION !== "8.5.12" || PHP_SAPI !== "cli") exit(1);'
/opt/php85/bin/php -n -r 'exit(function_exists("mb_strlen") ? 1 : 0);'
dpkg-query -W -f='${binary:Package}\t${Version}\n' > /opt/php85/evidence/build-packages.txt
