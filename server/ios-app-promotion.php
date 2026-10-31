<?php
declare(strict_types=1);

function ios_app_config(): array {
    static $config;
    return $config ??= json_decode(file_get_contents(__DIR__.'/ios-app-promotion.json'), true, 16, JSON_THROW_ON_ERROR);
}

function ios_app_banner(string $path, string $robots = 'index,follow'): string {
    if (stripos($robots, 'noindex') !== false || preg_match('#^/(?:otomado|admin|submit|go)(?:/|$)#', $path)
        || preg_match('#^/(?:404|offline)(?:\.html)?$#', $path)) return '';
    $config = ios_app_config();
    $content = 'app-id='.$config['appId'];
    if (is_string($config['providerToken']) && preg_match('/^\d+$/D', $config['providerToken'])) {
        $content .= ', affiliate-data=pt='.$config['providerToken'].'&ct=web_banner&mt=8';
    }
    return '<meta name="apple-itunes-app" content="'.htmlspecialchars($content, ENT_QUOTES, 'UTF-8').'">';
}

// Four fixed destinations. No incoming query, referrer, URL or path is forwarded.
function ios_app_redirect(string $uri, string $method): array {
    $config = ios_app_config();
    $path = parse_url($uri, PHP_URL_PATH);
    $routes = [];
    foreach ($config['campaigns'] as $placement => $campaign) $routes['/go/ios/'.$placement] = $campaign;
    if (!is_string($path) || !isset($routes[$path])) return ['status' => 404];
    if (!in_array($method, ['GET', 'HEAD'], true)) return ['status' => 405];
    $url = $config['storeUrl'];
    if (is_string($config['providerToken']) && preg_match('/^\d+$/D', $config['providerToken'])) {
        $url .= '?'.http_build_query(['pt' => $config['providerToken'], 'ct' => $routes[$path], 'mt' => '8'], '', '&', PHP_QUERY_RFC3986);
    }
    return ['status' => 302, 'location' => $url];
}
