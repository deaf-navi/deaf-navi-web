<?php
// Candidate only: do not run outside the disposable, isolated Linux fixture.
if (PHP_SAPI !== 'cli' || getenv('FIXTURE_ONLY') !== '1' || !is_file('/fixture/FIXTURE_ONLY')) {
    throw new RuntimeException('Isolated synthetic CLI fixture required');
}
$phase = $argv[1] ?? '';
if (!in_array($phase, ['install', 'seed', 'snapshot'], true)) {
    throw new RuntimeException('Expected install, seed, or snapshot');
}
$scenario = getenv('FIXTURE_SCENARIO');
if (!in_array($scenario, ['default', 'smtp'], true)) {
    throw new RuntimeException('Invalid fixture scenario');
}
$diagnostics = [];
set_error_handler(static function ($severity, $message, $file, $line) use (&$diagnostics) {
    if (!(error_reporting() & $severity)) return false;
    $diagnostics[] = ['severity'=>$severity, 'message'=>$message, 'file'=>$file, 'line'=>$line];
    return true;
});
register_shutdown_function(static function () use ($phase, $scenario, &$diagnostics) {
    $last = error_get_last();
    $fatal = $last && in_array($last['type'], [E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR], true) ? $last : null;
    file_put_contents('/evidence/' . $scenario . '-' . $phase . '-runtime.json', json_encode([
        'mail_blocked'=>$GLOBALS['fixture_mail_blocked'] ?? 0,
        'http_blocked'=>$GLOBALS['fixture_http_blocked'] ?? 0,
        'mail_delivery_success'=>false, 'diagnostics'=>$diagnostics, 'fatal'=>$fatal
    ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
});
if ($phase === 'install') define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = 'fixture.invalid';
$_SERVER['SERVER_NAME'] = 'fixture.invalid';
$_SERVER['REQUEST_URI'] = '/';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['SERVER_PROTOCOL'] = 'HTTP/1.1';
require '/var/www/html/wp-load.php';
if (!has_filter('pre_wp_mail') || !isset($GLOBALS['fixture_mail_blocked'])) {
    throw new RuntimeException('Mail guard missing before install/bootstrap');
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
if ($phase === 'install') {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    if (is_blog_installed()) throw new RuntimeException('Fresh disposable database required');
    wp_install('Synthetic Fixture Site', 'fixture-admin', 'fixture@example.invalid', false, '', 'Fixture-Only-Admin-Password-42!', 'en_US');
    if ($GLOBALS['fixture_mail_blocked'] < 1) throw new RuntimeException('Install mail guard was not exercised');
    $result = activate_plugin('wp-mail-smtp/wp_mail_smtp.php', '', false, false);
    if (is_wp_error($result)) throw new RuntimeException('Fixture plugin activation failed');
    echo "INSTALL_AND_ACTIVATION_COMPLETE_MAIL_BLOCKED\n";
    exit;
}
$options = WPMailSMTP\Options::init();
if ($phase === 'seed') {
    $candidate = [
        'mail'=>['mailer'=>$scenario === 'smtp' ? 'smtp' : 'mail', 'from_email'=>'sender@example.invalid', 'from_name'=>'Synthetic Fixture Sender', 'from_email_force'=>true, 'from_name_force'=>true, 'return_path'=>true],
        'smtp'=>['host'=>'smtp.invalid', 'port'=>2525, 'encryption'=>'none', 'autotls'=>false, 'auth'=>true, 'user'=>'fixture-user', 'pass'=>'Fixture-Only-SMTP-Password-42!'],
    ];
    $options->set($candidate, false, true);
    echo "SYNTHETIC_SETTINGS_SAVED\n";
    exit;
}
$selected = [];
foreach (['mail'=>['mailer','from_email','from_name','from_email_force','from_name_force','return_path'], 'smtp'=>['host','port','encryption','autotls','auth','user','pass']] as $group=>$keys) {
    foreach ($keys as $key) $selected[$group][$key] = $options->get($group, $key);
}
$plugin = get_plugin_data(WP_PLUGIN_DIR . '/wp-mail-smtp/wp_mail_smtp.php', false, false);
echo json_encode([
    'scenario'=>$scenario, 'plugin_version'=>$plugin['Version'],
    'selected_settings_sha256'=>hash('sha256', json_encode($selected, JSON_THROW_ON_ERROR)),
    'raw_option_sha256'=>hash('sha256', serialize(get_option('wp_mail_smtp'))),
    'smtp_dummy_password_roundtrip'=>$scenario !== 'smtp' || $selected['smtp']['pass'] === 'Fixture-Only-SMTP-Password-42!',
    'expected_dummy_values'=>$selected['mail']['mailer'] === ($scenario === 'smtp' ? 'smtp' : 'mail')
        && $selected['mail']['from_email'] === 'sender@example.invalid'
        && $selected['mail']['from_name'] === 'Synthetic Fixture Sender'
        && ($scenario !== 'smtp' || ($selected['smtp']['host'] === 'smtp.invalid' && (int)$selected['smtp']['port'] === 2525)),
    'active'=>is_plugin_active('wp-mail-smtp/wp_mail_smtp.php')
], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
