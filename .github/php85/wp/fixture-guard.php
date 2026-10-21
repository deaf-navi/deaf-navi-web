<?php
// Install as wp-content/mu-plugins/000-fixture-guard.php before wp_install().
if (getenv('FIXTURE_ONLY') !== '1' || !is_file('/fixture/FIXTURE_ONLY')) {
    throw new RuntimeException('Synthetic fixture marker required');
}
$GLOBALS['fixture_mail_blocked'] = 0;
$GLOBALS['fixture_http_blocked'] = 0;
add_filter('pre_wp_mail', static function ($return) {
    ++$GLOBALS['fixture_mail_blocked'];
    return false; // Deliberately not a successful delivery result.
}, PHP_INT_MAX, 1);
add_filter('pre_http_request', static function () {
    ++$GLOBALS['fixture_http_blocked'];
    return new WP_Error('fixture_offline', 'External HTTP blocked by fixture');
}, PHP_INT_MAX, 0);
add_filter('automatic_updater_disabled', '__return_true', PHP_INT_MAX);
add_filter('wp_auto_update_core', '__return_false', PHP_INT_MAX);
add_filter('auto_update_plugin', '__return_false', PHP_INT_MAX);
add_filter('auto_update_theme', '__return_false', PHP_INT_MAX);
add_filter('pre_spawn_cron', '__return_true', PHP_INT_MAX);
