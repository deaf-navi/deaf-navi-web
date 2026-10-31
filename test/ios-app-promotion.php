<?php
declare(strict_types=1);
require __DIR__.'/../server/ios-app-promotion.php';
function check(bool $ok, string $label): void { if (!$ok) throw new RuntimeException($label); }
foreach (['top','guide','footer','about'] as $placement) {
    $path='/go/ios/'.$placement;
    $r=ios_app_redirect($path.'?url=https://example.invalid/&pt=bad&ct=bad', 'GET');
    check($r['status']===302, 'GET redirects');
    $url=parse_url($r['location']);
    check($url['host']==='apps.apple.com' && $url['path']==='/jp/app/deaf-navi/id6761352199', 'fixed app destination');
    check(!str_contains($r['location'],'bad') && !str_contains($r['location'],'example.invalid'), 'query is never forwarded');
    if (ios_app_config()['providerToken']) {
        parse_str($url['query'], $query);
        check($query===['pt'=>ios_app_config()['providerToken'],'ct'=>'web_'.$placement,'mt'=>'8'], 'placement attribution');
    }
    check(ios_app_redirect($path,'HEAD')===$r, 'HEAD preserves redirect without a body');
    check(ios_app_redirect($path,'POST')['status']===405, 'POST is not a click');
}
foreach (['/go/ios/','/go/ios/bogus','/go/ios/top/','/go/ios/top%0d%0aX-Test:bad'] as $path) {
    check(ios_app_redirect($path, 'GET')['status']===404, 'unknown route fails closed');
}
foreach (['/otomado/','/submit/','/admin/','/go/ios/top','/404.html'] as $path) check(ios_app_banner($path)==='', 'excluded banner');
check(ios_app_banner('/stories/example/', 'noindex,nofollow')==='', 'private preview has no banner');
check(str_contains(ios_app_banner('/connect/sign-cafe/'), 'app-id=6761352199'), 'PHP public banner');
echo "iOS app promotion: fixed routes, attribution and banner exclusions passed\n";
