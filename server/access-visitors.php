<?php
declare(strict_types=1);

// Separate from sessions and the directory database. No network identifiers are stored.
const ACCESS_CLIENTS = ['human'=>'一般ブラウザー（推定）','all'=>'すべての分類（調査用）','bot'=>'bot・検索クローラー','ai'=>'AI・Codex','automation'=>'自動操作・監視','internal'=>'管理画面','unknown'=>'不明・分類開始前'];

function access_client(string $ua, string $marker=''): string {
    if (preg_match('/codex|openai/i', $marker)) return 'ai';
    if ($marker === 'automation') return 'automation';
    if (preg_match('/GPTBot|OAI-SearchBot|ChatGPT|OpenAI|Codex|Claude|Anthropic|Perplexity|Bytespider|cohere-ai/i', $ua)) return 'ai';
    if (preg_match('/bot|crawler|spider|slurp|facebookexternalhit|WhatsApp|TelegramBot/i', $ua)) return 'bot';
    if (preg_match('/curl|wget|python|httpx|headless|playwright|puppeteer|selenium|deafnavi-release|uptime|monitor|Go-http-client|node|undici/i', $ua)) return 'automation';
    return preg_match('/Mozilla\/|Opera\//i', $ua) ? 'human' : 'unknown';
}

function access_visitor_dir(): string {
    return getenv('DEAFNAVI_LOCAL_TEST') === '1'
        ? (getenv('DEAFNAVI_VISITOR_DIR') ?: data_dir().'/access-visitors')
        : '/srv/deafnavi/shared/access-visitors';
}

function access_visitor_db(bool $write=false): PDO {
    $path = access_visitor_dir().'/visitors.sqlite';
    if (!is_file($path) || is_link($path)) throw new RuntimeException('Visitor storage unavailable');
    $db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=1500');
    if (!$write) $db->exec('PRAGMA query_only=ON');
    return $db;
}

function access_visitor_init(): void {
    $dir = access_visitor_dir();
    if (!is_dir($dir) || is_link($dir)) throw new RuntimeException('Private visitor directory required');
    $key = $dir.'/secret.key';
    if (!file_exists($key)) {
        $f = fopen($key, 'x');
        if (!$f) throw new RuntimeException('Cannot create visitor key');
        chmod($key, 0600); fwrite($f, random_bytes(32)); fclose($f);
    }
    if (is_link($key) || filesize($key)!==32) throw new RuntimeException('Invalid visitor key');
    $path = $dir.'/visitors.sqlite';
    if (is_link($path)) throw new RuntimeException('Visitor database symlink refused');
    $db = new PDO('sqlite:'.$path);
    chmod($path, 0640);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS visits (
        day TEXT NOT NULL, visitor TEXT NOT NULL, path TEXT NOT NULL,
        PRIMARY KEY(day,visitor,path)
    ) WITHOUT ROWID; CREATE INDEX IF NOT EXISTS visits_path_day ON visits(path,day);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS excluded_visitors (
        day TEXT NOT NULL, visitor TEXT NOT NULL, reason TEXT NOT NULL,
        PRIMARY KEY(day,visitor)
    ) WITHOUT ROWID;');
    $s = $db->prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)');
    $s->execute(['started_at', gmdate('c')]);
}

function access_visitor_identity(string $ip, string $ua, ?DateTimeImmutable $at=null): ?array {
    $packed = @inet_pton($ip);
    if ($packed === false || $ua === '' || strlen($ua)>2048) return null;
    $day = ($at ?? new DateTimeImmutable())->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d');
    $key = access_visitor_dir().'/secret.key';
    if (is_link($key) || !is_file($key)) throw new RuntimeException('Visitor key unavailable');
    $secret = file_get_contents($key);
    if (strlen($secret)!==32) throw new RuntimeException('Invalid visitor key');
    $visitor = hash_hmac('sha256', $day."\0".$packed."\0".$ua, $secret);
    return [$day,$visitor];
}

function access_exclude_visitor(string $ip, string $ua, string $reason, ?DateTimeImmutable $at=null): void {
    if (!in_array($reason,['ai','automation'],true)) return;
    $identity = access_visitor_identity($ip,$ua,$at);
    if (!$identity) return;
    $s = access_visitor_db(true)->prepare('INSERT OR IGNORE INTO excluded_visitors(day,visitor,reason) VALUES(?,?,?)');
    $s->execute([...$identity,$reason]);
}

function access_record_visit(string $path, string $ip, string $ua, ?DateTimeImmutable $at=null): void {
    $identity = access_visitor_identity($ip,$ua,$at);
    if (!$identity) return;
    [$day,$visitor] = $identity;
    // One row per day, inferred visitor and page. A reload or retry adds no duplicate.
    $s = access_visitor_db(true)->prepare('INSERT OR IGNORE INTO visits(day,visitor,path)
        SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM excluded_visitors WHERE day=? AND visitor=?)');
    $s->execute([$day,$visitor,$path,$day,$visitor]);
}

function access_visit_endpoint(): never {
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    if (($_SERVER['REQUEST_METHOD']??'')!=='POST') { http_response_code(405); header('Allow: POST'); exit; }
    $origin = getenv('DEAFNAVI_LOCAL_TEST') === '1' ? 'http://'.($_SERVER['HTTP_HOST']??'') : 'https://deafnavi.com';
    if (($_SERVER['HTTP_ORIGIN']??'')!==$origin || !str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json')) { http_response_code(403); exit; }
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>1024) { http_response_code(413); exit; }
    $body = file_get_contents('php://input', false, null, 0, 1025);
    $data = strlen($body)<=1024 ? json_decode($body,true,4) : null;
    $path = is_array($data) ? ($data['path']??null) : null;
    if (!is_string($path) || strlen($path)>500 || !preg_match('#^/[A-Za-z0-9_/%.-]*$#D',$path)
        || preg_match('#[.]{2}|//|%(?:2e|2f|5c|00)#i',$path)
        || preg_match('#^/(?:admin|submit|_backend|_access|app)(?:/|$)#',$path)) { http_response_code(400); exit; }
    $path = preg_replace('#/index\.html$#','/',$path);
    // Accept public HTML pages only. API/assets remain covered by the Caddy request log.
    $root = getenv('DEAFNAVI_LOCAL_TEST') === '1' ? realpath(__DIR__.'/../docs') : '/srv/deafnavi/current';
    $file = $root.$path.(str_ends_with($path,'/')?'index.html':'');
    if (!str_starts_with($path,'/connect/sign-cafe/') && (!is_file($file) || !str_ends_with($file,'.html'))) { http_response_code(400); exit; }
    $ua = substr($_SERVER['HTTP_USER_AGENT']??'',0,2049);
    $marker = substr($_SERVER['HTTP_X_DEAFNAVI_CLIENT']??'',0,100);
    $client = access_client($ua,$marker);
    try {
        if ($client !== 'human' || ($data['automated']??false)===true) {
            // A normal browser identified as Codex later also leaves today's earlier UU out.
            // Keep the original visit rows; do not guess at other connections or earlier days.
            if (access_client($ua)==='human') access_exclude_visitor($_SERVER['REMOTE_ADDR']??'',$ua,$client==='ai'?'ai':'automation');
            http_response_code(204); exit;
        }
        // REMOTE_ADDR is provided by Caddy. Never trust public X-Forwarded-For headers.
        access_record_visit($path,$_SERVER['REMOTE_ADDR']??'',$ua);
        http_response_code(204);
    } catch (Throwable) { http_response_code(503); }
    exit;
}

function access_unique_report(array $options): array {
    $result = ['available'=>false,'days'=>[],'paths'=>[],'total'=>0,'started_at'=>null];
    try {
        $db = access_visitor_db();
        $result['started_at'] = $db->query("SELECT value FROM metadata WHERE key='started_at'")->fetchColumn() ?: null;
        $where = 'day>=? AND day<=? AND NOT EXISTS (SELECT 1 FROM excluded_visitors x WHERE x.day=visits.day AND x.visitor=visits.visitor)'; $args = [$options['from'],$options['to']];
        if ($options['q']!=='') { $where .= ' AND instr(lower(path),lower(?))>0'; $args[]=$options['q']; }
        $s = $db->prepare('SELECT day,COUNT(DISTINCT visitor) AS count FROM visits WHERE '.$where.' GROUP BY day ORDER BY day DESC');
        $s->execute($args);
        foreach ($s as $r) { $result['days'][$r['day']]=(int)$r['count']; $result['total']+=(int)$r['count']; }
        if (($options['summary']??false)!==true) {
            $s = $db->prepare('SELECT path,COUNT(*) AS count FROM visits WHERE '.$where.' GROUP BY path ORDER BY count DESC LIMIT 50');
            $s->execute($args); $result['paths']=$s->fetchAll();
        }
        $result['available']=true;
    } catch (Throwable) { /* Display unavailable, never invent a zero. */ }
    return $result;
}

if (PHP_SAPI==='cli' && realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__) {
    if (($argv[1]??'')!=='init') exit(2);
    access_visitor_init(); echo "VISITOR_STORAGE_OK\n";
}
