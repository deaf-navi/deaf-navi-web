import {DOMESTIC_PAGES} from '../../config/domestic-pages.mjs';
import {fetchThumbnailResource} from './thumbnail-fetch.mjs';
import {cleanHtml,cleanSummaryText} from './text.mjs';
import {validIsoDay} from '../../scripts/curation-review-contract.mjs';

export function parseDomesticPage(html,source) {
  if(source.parser!=='jdba-blog')throw new Error('Unsupported official page parser');
  const entries=[];
  for(const block of html.split(/<div\s+class=["']art["']\s*>/i).slice(1)){
    const heading=block.match(/<div\s+class=["']art-title["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const number=heading?.match(/<a\s+name=["'](\d+)["']/i)?.[1];
    const title=cleanHtml(heading??'');
    const date=block.match(/<div\s+class=["']art-date["'][^>]*>[\s\S]*?(20\d{2})\/(\d{2})\/(\d{2})\([A-Za-z]+\)\s+(\d{2}:\d{2}:\d{2})/i);
    if(!number||!title||!date)continue;
    const day=`${date[1]}-${date[2]}-${date[3]}`;
    if(!validIsoDay(day))continue;
    // Use only a permalink actually present on this index, not a guessed route.
    const path=`resp${number}_${date[1]}${date[2]}.html`;
    if(!html.includes(`href="${path}"`)&&!html.includes(`href='${path}'`))continue;
    const raw=block.match(/<div\s+class=["']art-com["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??'';
    // New source cards use an original factual summary; full source text is not republished.
    const summary='全国盲ろう者協会が公開したお知らせです。詳細は公式情報をご確認ください。';
    entries.push({id:new URL(path,source.url).href,title,summary,
      sourceName:source.sourceName,sourceUrl:source.sourceUrl,
      publishedAt:new Date(day+'T'+date[4]+'+09:00').toISOString(),sourceType:'official-page',
      _reviewExcerpt:cleanSummaryText(cleanHtml(raw),title,source.sourceName).slice(0,1100),
    });
  }
  if(!entries.length)throw new Error('Official page structure or publication dates changed');
  return entries;
}

export async function collectDomesticPages({sources=DOMESTIC_PAGES,fetchResource=fetchThumbnailResource}={}) {
  const articles=[],health={requested:sources.length,succeeded:0,failed:[]};
  for(const source of sources){
    try{
      const result=await fetchResource(source.url,{userAgent:'DeafNaviWeb-Discovery/1.0 (+https://deafnavi.com/)',maxBytes:800000,timeoutMs:15000,allowUrl:url=>url===source.url});
      if(result.status!==200||!/text\/html|application\/xhtml\+xml/i.test(result.headers?.['content-type']??''))throw new Error('Official HTML unavailable');
      const entries=parseDomesticPage(result.text,source);
      articles.push(...entries.map(entry=>({...entry,_sourceTier:source.sourceTier,_minScore:source.minScore,_feedUrl:source.url})));
      health.succeeded++;
    }catch{health.failed.push({id:source.id,reason:'source-unavailable-or-changed'});}
  }
  return {articles,health};
}
