<?php
declare(strict_types=1);

const ACCESS_CONTENTS = ['web'=>'Deaf Navi Web','world_jp'=>'World-JP','world_original'=>'World-Original','cafe'=>'手話カフェ','cafe_overseas'=>'手話カフェ 海外','guide'=>'暮らしのガイド','otomado'=>'おとまど','about'=>'サイトについて'];
const ACCESS_EXCLUSIONS = ['bot'=>'bot・検索エンジン','ai'=>'AI・Codex','automation'=>'自動取得・監視','internal'=>'管理・情報提供','unknown'=>'分類不明','probe'=>'不審なURL探索','not_found'=>'その他の404','unsuccessful'=>'転送・エラー・GET以外','resource'=>'API・画像・システム取得','unlisted'=>'対象外のページ'];

function access_content(string $path): ?string {
    $path = rawurldecode(explode('?', $path, 2)[0]);
    if (preg_match('#[\x00-\x20\x7f\\\\]|\.\.|//#', $path)) return null;
    $path = preg_replace('#/index\.html$#D', '/', $path);
    $fixed = ['/' => 'web','/index-old.html'=>'web','/deaf-navi-world-jp.html'=>'world_jp','/deaf-navi-world-original.html'=>'world_original',
        '/connect/'=>'cafe','/connect/sign-cafe/'=>'cafe','/connect/sign-cafe/map/'=>'cafe',
        '/connect/sign-cafe/overseas/'=>'cafe_overseas','/guide.html'=>'guide','/otomado/'=>'otomado','/about.html'=>'about'];
    if (isset($fixed[$path])) return $fixed[$path];
    if (preg_match('#^/archive/(?:[0-9]{4}-[0-9]{2}|legacy)\.html$#D', $path)) return 'web';
    if (!preg_match('#^/connect/sign-cafe/(?:starbucks/)?[a-z0-9-]+/$#D', $path)) return null;
    static $cafes;
    if ($cafes === null) {
        $file = (getenv('DEAFNAVI_DATA_DIR') ?: '/srv/deafnavi/shared/directory').'/directory.sqlite';
        if (!is_file($file)) throw new RuntimeException('Content classification unavailable');
        $db = new PDO('sqlite:'.$file, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $db->exec('PRAGMA query_only=ON; PRAGMA busy_timeout=1500');
        $cafes = [];
        foreach ($db->query('SELECT slug,kind,country_code FROM records') as $row) {
            $url = '/connect/sign-cafe/'.($row['kind']==='event'?'starbucks/':'').$row['slug'].'/';
            $cafes[$url] = $row['country_code']==='JP' ? 'cafe' : 'cafe_overseas';
        }
    }
    return $cafes[$path] ?? null;
}

function access_exclusion(array $row): ?string {
    $path = rawurldecode($row['path']);
    if (preg_match('#(?:^|/)(?:\.env(?:\.|/|$)|\.git(?:/|$)|wp-admin|wp-login|xmlrpc|phpmyadmin|vendor/phpunit|cgi-bin)|\.(?:php[0-9]?|asp[x]?|jsp|sql|bak)(?:/|$)|\.\.|[<>\x00-\x1f]#i', $path)) return 'probe';
    if (preg_match('#^/(?:admin|submit)(?:/|$)#', $path)) return 'internal';
    if ($row['client']!=='human') return isset(ACCESS_EXCLUSIONS[$row['client']]) ? $row['client'] : 'unknown';
    if ($row['status']===404) return 'not_found';
    // 304 represents a successful cached page view. Redirects and failed responses do not.
    if ($row['method']!=='GET' || !in_array($row['status'],[200,304],true)) return 'unsuccessful';
    if ($row['group']!=='pages') return 'resource';
    if (access_content($row['path'])===null) return 'unlisted';
    return null;
}
