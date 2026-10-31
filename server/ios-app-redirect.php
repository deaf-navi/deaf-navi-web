<?php
declare(strict_types=1);
require_once __DIR__.'/ios-app-promotion.php';
$result = ios_app_redirect($_SERVER['REQUEST_URI'] ?? '/', $_SERVER['REQUEST_METHOD'] ?? 'GET');
header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
http_response_code($result['status']);
if (isset($result['location'])) header('Location: '.$result['location'], true, 302);
if ($result['status'] === 405) header('Allow: GET, HEAD');
// No session, cookies, database, JavaScript tracking or response body.
