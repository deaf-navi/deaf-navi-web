<?php
if (getenv('FIXTURE_ONLY') !== '1' || !is_file('/fixture/FIXTURE_ONLY')) {
    throw new RuntimeException('Synthetic fixture marker required');
}
$scenario = getenv('FIXTURE_SCENARIO');
if (!in_array($scenario, ['default', 'smtp'], true)) {
    throw new RuntimeException('Invalid fixture scenario');
}
define('DB_NAME', 'wp_fixture_' . $scenario);
define('DB_USER', 'fixture');
define('DB_PASSWORD', 'Fixture-Only-DB-Password-42!');
define('DB_HOST', 'fixture-db:3306');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');
$table_prefix = 'fixture_';
foreach (['AUTH_KEY','SECURE_AUTH_KEY','LOGGED_IN_KEY','NONCE_KEY','AUTH_SALT','SECURE_AUTH_SALT','LOGGED_IN_SALT','NONCE_SALT'] as $name) {
    define($name, hash('sha256', 'synthetic-offline-fixture-fixed-salt-' . $name));
}
define('WP_HOME', 'http://fixture.invalid');
define('WP_SITEURL', 'http://fixture.invalid');
define('WP_HTTP_BLOCK_EXTERNAL', true);
define('WP_ACCESSIBLE_HOSTS', '');
define('DISABLE_WP_CRON', true);
define('AUTOMATIC_UPDATER_DISABLED', true);
define('WP_AUTO_UPDATE_CORE', false);
define('DISALLOW_FILE_EDIT', true);
define('DISALLOW_FILE_MODS', true);
define('WP_DEBUG', true);
define('WP_DEBUG_DISPLAY', false);
define('WP_DEBUG_LOG', false);
define('WP_ENVIRONMENT_TYPE', 'local');
define('WP_CACHE', false);
if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
