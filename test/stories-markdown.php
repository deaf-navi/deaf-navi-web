<?php
declare(strict_types=1);
// Pure renderer tests: no database, credentials or publication.
define('BASE','https://deafnavi.com');
function e(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function story_cut(string $s,int $n):string{return $s;}
function story_url(string $s):bool{return str_starts_with($s,'https://');}
function story_internal(string $s):bool{return $s==='/connect/sign-cafe/';}
require __DIR__.'/../server/stories-render.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
$r=story_markdown("| 項目 | 内容 | 金額 |\n| :--- | :---: | ---: |\n| **会話** | 筆談\\|手話 | 500 |\n| <script>x</script> | [危険](javascript:alert) |\n\n## 次の見出し");
check(substr_count($r['html'],'<th scope="col"')===3,'semantic header');
check(str_contains($r['html'],'story-align-center')&&str_contains($r['html'],'story-align-right'),'alignment');
check(str_contains($r['html'],'筆談|手話'),'escaped pipe');
check(str_contains($r['html'],'<strong>会話</strong>'),'inline table markup');
check(str_contains($r['html'],'&lt;script&gt;')&&!str_contains($r['html'],'href="javascript:'),'table escaping');
check(count($r['toc'])===1,'table does not swallow heading');
check(str_contains(story_markdown("項目 | 内容\n--- | ---\nA | B")['html'],'<table>'),'optional outer pipes');
check(!str_contains(story_markdown("a | b\nnot | delimiter")['html'],'<table>'),'ordinary pipes remain text');
check(str_contains(story_markdown("```html\n<script>x</script>\n| a | b |\n```\n\n後続")['html'],'<pre><code>&lt;script&gt;'),'fenced code escapes');
check(str_ends_with(story_markdown("~~~\n未終了")['html'],'未終了</code></pre>'),'unclosed code fence');
check(story_inline('`**文字**` ~~以前~~')==='<code>**文字**</code> <del>以前</del>','inline code and strike');
check(str_contains(story_markdown("#### 小見出し")['html'],'<h4'),'small headings');
check(str_contains(story_markdown("| 列 |\n| --- |\n| 値 |")['html'],'<table>'),'single column');
echo "Markdown checks passed\n";
check(story_character_count("## 見出し\n\n**本文** [案内](https://example.com/)\n\n| 列 |\n| --- |\n| 値 |")===9,'count visible heading, link label and table without markup');
check(story_character_count('![長い代替テキスト](/stories/media/'.str_repeat('a',32).'.webp "説明")')===2,'count caption but not image alt or URL');
check(story_character_count("𠮷 あ　\n\t<>&")===5,'count Unicode code points and literal HTML once, excluding whitespace');
check(story_character_count('')===0,'empty count');
