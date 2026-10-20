<?php
declare(strict_types=1);
function stories_editor_user():array {$u=require_user(true);if($u['must_change'])fail('先に初期パスワードを変更してください。',403);return $u;}
function story_lines(string $json):string {return implode("\n",array_map(fn($l)=>$l['label'].' | '.$l['url'],json_decode($json,true)?:[]));}
function story_form_data(array $r):array {
    $r['tags']=implode(',',json_decode($r['tags'],true)?:[]);$r['sources']=story_lines($r['sources']);$r['related']=story_lines($r['related']);
    unset($r['published_at']);if(!$r['featured'])unset($r['featured']);return $r;
}
function stories_bulk_rows(mixed $selected):array {
    if(!is_array($selected)||!$selected||count($selected)>25)fail('記事を1〜25件選んでください。');$rows=[];
    foreach($selected as $id=>$revision){
        if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||!is_scalar($revision)||!ctype_digit((string)$revision))fail('選択内容を確認してください。');
        $r=story_get($id);if((int)$r['revision']!==(int)$revision)fail('別の保存が先に行われました。一覧から選び直してください。',409);$rows[]=$r;
    }return $rows;
}
function stories_bulk_review(array $post,array $user):string {
    $rows=stories_bulk_rows($post['selected']??null);$target=choice(input($post,'target',20),['draft'=>1,'published'=>1]);
    $nonce=bin2hex(random_bytes(32));$_SESSION['stories_bulk']=['token'=>$nonce,'selected'=>$post['selected'],'target'=>$target,'expires'=>time()+900];
    $label=$target==='published'?'公開する':'下書きに戻す';$body='<h2>選んだ記事を'.$label.'：確認</h2><p>以下の'.count($rows).'件が対象です。未来の公開日時は予約として維持します。競合や入力エラーがある場合は全件を変更せずに戻します。</p><ul>';
    foreach($rows as $r)$body.='<li>'.e($r['title']).'（'.e($r['slug']).'）</li>';
    $body.='</ul><form method="post" action="/admin/stories/">'.csrf().'<input type="hidden" name="action" value="bulk_apply"><input type="hidden" name="confirmation" value="'.$nonce.'"><button>確認した記事を'.$label.'</button> <a href="/admin/?view=stories">変更せず一覧へ戻る</a></form>';
    return admin_shell($body,$user,'stories');
}
function stories_bulk_apply(array $post,string $actor):void {
    $confirmation=input($post,'confirmation',64);$pending=$_SESSION['stories_bulk']??null;
    if(!$pending||$pending['expires']<time()||!hash_equals($pending['token'],$confirmation))fail('確認画面からやり直してください。',409);
    $rows=stories_bulk_rows($pending['selected']);$db=stories_db();stories_backup($db);$db->exec('BEGIN IMMEDIATE');
    try{foreach($rows as $r){$in=story_form_data($r);$in['status']=$pending['target'];story_save($in,$actor,$db);}$db->exec('COMMIT');unset($_SESSION['stories_bulk']);}
    catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function story_field(string $name,string $label,mixed $value='',string $type='text',bool $required=false):string {
    $limits=['title'=>300,'slug'=>100,'tags'=>1000,'author'=>200,'alt'=>600,'checked_at'=>10,'published_at'=>30];
    return str_replace('maxlength="2000"','maxlength="'.($limits[$name]??2000).'"',field($name,$label,$value,$type,$required));
}
function stories_admin():string {
    $user=stories_editor_user();$id=input($_GET,'id',64);$mode=input($_GET,'mode',20);$head='<link rel="stylesheet" href="/stories.css?v=20261020proof1"><script src="/stories-editor.js?v=20261020md1" defer></script>';
    if($mode==='edit'){
        $r=$id?story_get($id):['id'=>'','revision'=>0,'title'=>'','slug'=>'','summary'=>'','body'=>'','category'=>'culture','tags'=>'[]','cover'=>'','alt'=>'','author'=>'Deaf Navi編集部','sources'=>'[]','related'=>'[]','checked_at'=>'','status'=>'draft','featured'=>0,'published_at'=>null];
        $out=$head.'<p><a href="/admin/?view=stories">読みもの管理へ戻る</a></p><form method="post" action="/admin/stories/" data-story-editor data-storage-key="'.e('deafnavi:story:v1:'.$user['id'].':'.($id?:'new')).'"><input type="hidden" name="action" value="save">'.csrf().'<input type="hidden" name="id" value="'.e($r['id']).'"><input type="hidden" name="revision" value="'.(int)$r['revision'].'">';
        $out.='<div data-recovery hidden class="stories-notice"><p data-recovery-message></p><button type="button" data-restore>退避した入力を復元</button> <button type="button" data-discard>退避した入力を破棄</button></div><p>入力内容はこのブラウザに一時保存します。共有端末では保存後にログアウトしてください。</p><p data-storage-status role="status"></p>';
        $out.=story_field('title','記事タイトル',$r['title'],'text',true).'<p data-count="title" role="status"></p>'.story_field('slug','URLスラッグ（半角英数字・ハイフン）',$r['slug'],'text',true).'<p>公開URL：/stories/スラッグ/。変更前のURLは同じ記事へ転送します。</p><p data-slug-status role="status"></p><label>概要・リード文<textarea name="summary" rows="3" maxlength="1500">'.e($r['summary']).'</textarea></label>';
        $out.='<p data-count="summary" role="status"></p>'.story_link_warning($r['body']);
        $out.='<div class="story-toolbar" role="group" aria-label="本文の書式">';foreach(['h2'=>'大見出し','h3'=>'中見出し','bold'=>'太字','italic'=>'斜体','ul'=>'箇条書き','ol'=>'番号リスト','quote'=>'引用','hr'=>'区切り線','table'=>'表','code'=>'コード','strike'=>'取り消し線','link'=>'リンク'] as $k=>$label)$out.='<button type="button" data-format="'.$k.'">'.$label.'</button>';
        $out.='</div><label>本文<textarea name="body" id="story-body-input" rows="22" maxlength="50000">'.e($r['body']).'</textarea></label><p data-count="body" role="status"></p><p>書式ボタンで記号を挿入できます。入力後に下のプレビューが更新されます。表・取り消し線・コード・見出し（##〜######）に対応しています。表は | で列を区切り、見出しの次の行に | --- | --- | を入れてください。HTMLは文字として表示されます。画像は下の登録欄から挿入してください。</p><button type="button" data-preview>編集中の本文をプレビュー</button><div class="story-prose story-edit-preview" data-editor-preview aria-live="polite"></div>';
        $out.='<fieldset><legend>記事の分類</legend>'.select_field('category','カテゴリ',stories_categories(),$r['category']).story_field('tags','タグ（カンマ区切り）',implode(', ',json_decode($r['tags'],true)?:[])).story_field('author','執筆者・編集主体（任意）',$r['author']).'</fieldset>';
        $out.='<fieldset><legend>画像</legend><label>画像ファイル（JPEG・PNG・WebP、2MBまで）<input type="file" accept="image/jpeg,image/png,image/webp" data-image-file></label><p>利用権利のある画像だけを登録してください。最大1600pxのWebPに変換し、位置情報などのメタデータは除去します。</p><label>挿入する画像の説明<input data-image-alt maxlength="300"></label><label>画像キャプション（任意）<input data-image-caption maxlength="300"></label><button type="button" data-image-upload>画像を登録</button><div data-image-result role="status"></div><input type="hidden" name="cover" value="'.e($r['cover']).'">'.($r['cover']?'<img class="story-upload-preview" src="'.story_media_url($r['cover']).'" alt="'.e($r['alt']).'">':'').story_field('alt','カバー画像の代替テキスト',$r['alt']).'<button type="button" data-clear-cover>カバー画像を外す</button></fieldset>';
        $out.='<fieldset><legend>出典・関連コンテンツ</legend><label>参考資料・出典（1行につき 説明 | https://URL）<textarea name="sources" rows="4" maxlength="8000">'.e(story_lines($r['sources'])).'</textarea></label>'.story_field('checked_at','情報確認日',$r['checked_at'],'date').'<label>関連するDeaf Naviのページ（1行につき 説明 | /パス）<textarea name="related" rows="4" maxlength="8000">'.e(story_lines($r['related'])).'</textarea></label><p>ニュース /、World /deaf-navi-world-jp.html、カフェ /connect/sign-cafe/、イベント /events.html、ガイド /guide.html、おとまど /otomado/ と実在する個別ページを指定できます。関連するページからも記事へリンクします。</p></fieldset>';
        $pub=$r['published_at']?(new DateTimeImmutable($r['published_at']))->setTimezone(new DateTimeZone('Asia/Tokyo'))->format('Y-m-d\TH:i'):'';
        $out.='<fieldset><legend>公開設定</legend>'.select_field('status','状態',['draft'=>'下書き（非公開）','published'=>'公開','archived'=>'アーカイブ（非公開）'],$r['status']).'<label><input type="checkbox" name="featured" value="1"'.($r['featured']?' checked':'').'> おすすめ記事に掲載</label>'.story_field('published_at','公開日時（日本時間・空欄で初回公開時に設定）',$pub,'datetime-local').'<p>「公開」で未来の日時を指定すると予約になります。日時到来後にサイトに反映されます。公開済みの記事を下書き・アーカイブにすると、公開URLとサイトマップから外れます。</p></fieldset><div class="story-save"><section aria-label="保存前チェック"><strong>保存前チェック（保存は止めません）</strong><ul data-check-list aria-live="polite"></ul></section><button type="submit">この内容で保存</button> <span data-save-status role="status"></span>'.($id?' <a href="/admin/stories/?preview='.e($id).'" target="_blank" rel="noopener">保存済み記事をプレビュー</a>':'').'</div></form>';
        return $out;
    }
    $q=input($_GET,'q',200);$status=input($_GET,'state',20);$category=input($_GET,'category',64);$where=['1=1'];$args=[];
    if($q!==''){$where[]="title LIKE ? ESCAPE '!'";$args[]='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';}if($status!==''){$where[]='status=?';$args[]=$status;}if($category!==''){$where[]='category=?';$args[]=$category;}
    $freshness=input($_GET,'freshness',20);if($freshness==='stale'){$where[]="checked_at!='' AND checked_at<=?";$args[]=(new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo')))->modify('-180 days')->format('Y-m-d');}
    $sort=input($_GET,'sort',20);$order=['updated_at'=>'datetime(updated_at)','published_at'=>'datetime(published_at)','checked_at'=>'checked_at'][$sort]??'datetime(updated_at)';
    $clause=implode(' AND ',$where);$total=(int)stories_query('SELECT COUNT(*) FROM stories WHERE '.$clause,$args)->fetchColumn();$pg=max(1,min((int)($_GET['page']??1),max(1,(int)ceil($total/25))));$rows=stories_query('SELECT * FROM stories WHERE '.$clause.' ORDER BY '.$order.' DESC,id LIMIT 25 OFFSET '.(($pg-1)*25),$args)->fetchAll();
    $out=$head.'<p>ニュースの自動収集とは別に、管理者が確認して公開する編集記事です。</p><p><a class="dn-cta" href="/admin/?view=stories&mode=edit">新しい記事を書く</a> <a href="/stories/">公開一覧を見る</a></p><form class="stories-search" method="get"><input type="hidden" name="view" value="stories">'.story_field('q','タイトル検索',$q).select_field('category','カテゴリ',[''=>'すべて']+stories_categories(),$category).select_field('state','状態',[''=>'すべて','draft'=>'下書き','published'=>'公開','archived'=>'アーカイブ'],$status).select_field('freshness','情報確認日',[''=>'すべて','stale'=>'確認から180日以上'],$freshness).select_field('sort','並び順',['updated_at'=>'更新日が新しい順','published_at'=>'公開日が新しい順','checked_at'=>'確認日が新しい順'],$sort).'<button>絞り込む</button></form>';
    $out.='<form id="stories-bulk" method="post" action="/admin/stories/">'.csrf().'<input type="hidden" name="action" value="bulk_review"><p>選択した記事を確認してから変更します（このページの最大25件）。</p><label class="story-proof-provider">校正の依頼先<select name="proof_provider"><option value="claude">Claudeなど（文章校正）</option><option value="gemini">Gemini（文章校正＋画像生成）</option></select></label><button name="export_proof" value="1">選んだ記事を校正用JSONで出力</button> <a href="#story-proof-import">校正結果の取り込みへ</a><p>JSON内に依頼文と返却形式を含めます。外部AIへの送信はご自身で行ってください。出力した管理者アカウントで7日以内に取り込めます。Geminiの画像生成は1回10記事までです。</p><button name="target" value="published">選んだ記事を公開する</button> <button name="target" value="draft">選んだ記事を下書きに戻す</button></form><div class="story-admin-list">'.admin_table_open('読みもの記事一覧').'<thead><tr><th>選択</th><th>記事</th><th>スラッグ</th><th>カテゴリ</th><th>状態</th><th>おすすめ</th><th>更新日（JST）</th><th>公開日（JST）</th><th>情報確認日</th><th>操作</th></tr></thead><tbody>';
    $cats=stories_categories();$staleBefore=(new DateTimeImmutable('today',new DateTimeZone('Asia/Tokyo')))->modify('-180 days')->format('Y-m-d');
    foreach($rows as $r)$out.='<tr><td><label><input type="checkbox" form="stories-bulk" name="selected['.e($r['id']).']" value="'.(int)$r['revision'].'"><span class="story-select-label">'.e($r['title']).' を選択</span></label></td><td><a href="/admin/?view=stories&mode=edit&id='.e($r['id']).'">'.e($r['title']).'</a></td><td>'.e($r['slug']).'</td><td>'.e($cats[$r['category']]??'').'</td><td>'.e($r['status']==='published'&&!story_public($r)?'予約':['draft'=>'下書き','published'=>'公開','archived'=>'アーカイブ'][$r['status']]).'</td><td>'.($r['featured']?'おすすめ':'—').'</td><td>'.e(story_date($r['updated_at'])).'</td><td>'.e(story_date($r['published_at'])).'</td><td>'.e($r['checked_at']).($r['checked_at']!==''&&$r['checked_at']<=$staleBefore?' <strong>180日以上・要確認</strong>':'').'</td><td><a href="/admin/stories/?preview='.e($r['id']).'" target="_blank" rel="noopener">プレビュー</a><form method="post" action="/admin/stories/">'.csrf().'<input type="hidden" name="action" value="duplicate"><input type="hidden" name="id" value="'.e($r['id']).'"><button>複製して下書き</button></form></td></tr>';
    if(!$rows)$out.='<tr><td colspan="10">記事はありません。「新しい記事を書く」から作成できます。</td></tr>';
    $out.='</tbody></table></div></div>'.admin_pager($pg,$total,25,['view'=>'stories','q'=>$q,'state'=>$status,'category'=>$category,'sort'=>$sort,'freshness'=>$freshness]);
    $out.='<details class="story-proof-import" id="story-proof-import"><summary>校正結果をまとめて取り込む</summary><p>校正JSONと、生成した画像があれば一緒に選択してください。ZIPは展開してください。画像は各2MB、全ファイル合計6MBまで。変更内容と画像を確認してから反映します。公開済み記事は反映後に公開内容も更新されます。</p><form method="post" enctype="multipart/form-data" action="/admin/stories/">'.csrf().'<input type="hidden" name="action" value="proof_review"><label>校正JSON<input type="file" name="proof_file" accept=".json,application/json" required></label><label>生成した画像（任意・最大10点）<input type="file" name="proof_images[]" accept="image/png,image/jpeg,image/webp" multiple></label><button>変更内容と画像を確認する</button></form></details>';
    $out.='<details><summary>カテゴリの追加・名称変更</summary><form method="post" action="/admin/stories/">'.csrf().'<input type="hidden" name="action" value="category">'.story_field('category_id','カテゴリID（既存IDで名称変更）').story_field('category_name','表示名').'<button>カテゴリを保存</button></form><ul>';foreach(stories_categories() as $id=>$label)$out.='<li>'.e($id).'：'.e($label).'</li>';return $out.'</ul></details>';
}
function stories_upload():array {
    $f=$_FILES['image']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||$f['size']>2*1024*1024||!is_uploaded_file($f['tmp_name']))fail('画像は2MB以内のJPEG・PNG・WebPを選んでください。');
    if(!function_exists('imagecreatefromstring')||!function_exists('imagewebp'))fail('画像処理が利用できません。管理者に確認してください。',503);
    $info=@getimagesize($f['tmp_name']);if(!$info||!in_array($info['mime'],['image/jpeg','image/png','image/webp'],true)||$info[0]*$info[1]>20000000||$info[0]>10000||$info[1]>10000)fail('画像形式またはサイズを確認してください。');
    $im=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$im)fail('画像を読み込めませんでした。');
    $scale=min(1,1600/max($info[0],$info[1]));$dst=imagecreatetruecolor(max(1,(int)($info[0]*$scale)),max(1,(int)($info[1]*$scale)));imagealphablending($dst,false);imagesavealpha($dst,true);imagecopyresampled($dst,$im,0,0,0,0,imagesx($dst),imagesy($dst),$info[0],$info[1]);
    $id=bin2hex(random_bytes(16));$path=stories_dir().'/media/'.$id.'.webp';$db=stories_db();stories_backup($db);
    if(!imagewebp($dst,$path,82))throw new RuntimeException('Image write failed');chmod($path,0600);imagedestroy($im);imagedestroy($dst);
    $db->prepare('INSERT INTO media VALUES(?,?)')->execute([$id,now()]);return ['id'=>$id,'url'=>story_media_url($id)];
}
