import {WORLD_LOCATION_REVIEWS} from '../../config/world-location-reviews.mjs';
import {sourceFingerprint} from './publication-ledger.mjs';
import {validSourceReview} from './source-review.mjs';
// Only explicit locations in source article text count. Publisher, query region,
// language, and the Japanese translation are not event-location evidence.
export const WORLD_REGION_LABELS = {
  asia_oceania: 'アジア・オセアニア', americas: '北米・中南米',
  europe_cis: 'ヨーロッパ・CIS', middle_east_africa: '中東・アフリカ', unknown: '地域未確認',
};
const places = [
  ['americas', /(?<![\p{L}\p{N}])U\.S\.(?![\p{L}\p{N}])|\b(?:in|from|across) (?:the )?USA\b/gu],
  ['americas', /(?<![\p{L}\p{N}])(?:Los [ÁA]ngeles|United States|Estados Unidos|Brazil|Brasil|M[eé]xico|Colombia|Canad[aá]|Chile|Argentina|Per[uú]|Ecuador|Bolivia|Uruguay|Paraguay|Venezuela|Guatemala|Costa Rica|New York|Toronto|S[aã]o Paulo|Rio de Janeiro|Bogot[aá])(?![\p{L}\p{N}])|アメリカ|米国|ブラジル|コロンビア|ロサンゼルス/giu],
  ['middle_east_africa', /(?<![\p{L}\p{N}])(?:C[oô]te d['’]Ivoire|Ivory Coast|South Africa|Afrique du Sud|Kenya|Nigeria|Ghana|Uganda|Tanzania|Rwanda|Ethiopia|Egypt|Palestine|Saudi Arabia|United Arab Emirates|Morocco|Tunisia|Zimbabwe|Zambia|Cameroon|S[eé]n[eé]gal)(?![\p{L}\p{N}])|コートジボワール|南アフリカ|ケニア|(?<![\p{L}\p{N}])(?:ب|ل|و)?(?:بورسعيد|الجونة|المغرب|رواندا|مصر)(?![\p{L}\p{N}])/giu],
  ['europe_cis', /(?<![\p{L}\p{N}])(?:France|Germany|Deutschland|Spain|Espa[nñ]a|Portugal|Italy|Italia|United Kingdom|Britain|England|Scotland|Wales|Ireland|Ukraine|Russia|Poland|Netherlands|Belgium|Sweden|Norway|Finland|Denmark|Austria|Switzerland|Czechia|Romania|Greece|Berlin|Madrid|Piacenza|Montauban|Россия|Україна|Украина)(?![\p{L}\p{N}])|フランス|ドイツ|スペイン|英国|イギリス/giu],
  ['asia_oceania', /(?<![\p{L}\p{N}])(?:Japan|China|Korea|Taiwan|India|Pakistan|Bangladesh|Nepal|Sri Lanka|Thailand|Vietnam|Viet Nam|Indonesia|Malaysia|Singapore|Philippines|Australia|New Zealand|Melbourne|Tokyo|Seoul|Mumbai|Delhi|Karnataka)(?![\p{L}\p{N}])|日本|中国|台湾|韓国|대한민국|서울|전주시|경남|밀양시|호주|중국|일본|台灣|香港|澳大利亚|新西兰/giu],
];
export function worldLocation(article, {reviews=WORLD_LOCATION_REVIEWS,ledger}={}) {
  const records=[...(ledger?.entries||[]),...reviews];
  const original = String(article.originalTitle ?? '')+' '+String(article.originalSummary ?? '');
  const reviewed=records.find(x=>x.id===article.id && x.reviewedBy==='human' && Number.isFinite(Date.parse(x.reviewedAt)) && Date.parse(x.reviewedAt)<=Date.now() && Object.hasOwn(WORLD_REGION_LABELS,x.region) && x.sourceFingerprint===sourceFingerprint(article) && typeof x.evidence==='string' && x.evidence.length>=2 && original.includes(x.evidence));
  if(reviewed)return {region:reviewed.region,regionLabel:WORLD_REGION_LABELS[reviewed.region],regionEvidence:{method:'human-review',status:'reviewed',reviewedAt:reviewed.reviewedAt,mentions:[reviewed.evidence]}};
  const sourced=records.find(x=>x.id===article.id && validSourceReview(x)
    && x.sourcePublishedAt===article.publishedAt && Object.hasOwn(WORLD_REGION_LABELS,x.region) && x.sourceFingerprint===sourceFingerprint(article));
  if(sourced)return {region:sourced.region,regionLabel:WORLD_REGION_LABELS[sourced.region],regionEvidence:{method:'codex-opus-source-review',status:sourced.region==='unknown'?'unconfirmed':'source-verified',reviewedAt:sourced.reviewedAt,mentions:[sourced.place],sources:sourced.sourceEvidence.map(x=>({url:x.url,method:x.method}))}};
  const text = original.normalize('NFKC').replace(/(?:日本|中国|台湾|台灣|香港|韓国|英国|米国|アメリカ|イギリス|フランス|ブラジル)(?:の)?(?:手話|手語|語)/gu,'')
    .replace(/Lengua de Señas Argentina/giu,'')
    .replace(/\b(?:New Zealand|Taiwan|Kenya|Japan|China|India|South Africa|Australia|France|Germany|Spain|Italy|Canada|Nigeria) Sign Language\b/giu,'');
  const matches = places.map(([region, pattern]) => ({region, matches:[...text.matchAll(pattern)].map(m=>m[0])})).filter(x=>x.matches.length);
  const regions=[...new Set(matches.map(x=>x.region))];
  const region = regions.length === 1 ? regions[0] : 'unknown';
  return {region, regionLabel:WORLD_REGION_LABELS[region], regionEvidence:{method:'source-text-v1', status:regions.length===1?'matched':regions.length?'ambiguous':'unconfirmed', mentions:[...new Set(matches.flatMap(x=>x.matches))]}};
}
