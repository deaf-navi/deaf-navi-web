/**
 * サイト全体の定数定義。
 * URL・ブランド文言・外部サービス設定はここだけを編集する。
 */

export const SITE_URL = 'https://deaf-navi.github.io/deaf-navi-web/';
export const SITE_NAME = 'Deaf Navi Web';
export const SITE_TAGLINE = '聴覚障害・難聴・手話に関するニュースと一次情報';
export const SITE_DESC = '聴覚障害・難聴・ろう者・手話に関する一次情報と報道を、出典と選定区分を明示して届ける無料ニュースキュレーション。制度・情報保障・医療・教育・技術・防災・文化・デフスポーツを1日3回更新します。';
export const SITE_KEYWORDS = '聴覚障害,難聴,ろう者,ろうあ者,中途失聴,手話,情報保障,アクセシビリティ,防災,技術,AI,イベント,講座,補聴器,人工内耳,手話言語条例,聴覚障害ニュース,手話ニュース,難聴者,デフ,deaf,字幕,電話リレー,要約筆記,ろう学校,聴覚特別支援';

export const APP_STORE_URL = 'https://apps.apple.com/jp/app/deaf-navi/id6761352199';

export const UPDATE_SCHEDULE_LABEL = '1日3回更新';
export const UPDATE_SCHEDULE_DETAIL = 'JST 6:00 / 12:00 / 18:00ごろ';

export const CURATE_USER_AGENT = 'DeafNaviWeb/1.1 (+https://deaf-navi.github.io/deaf-navi-web/)';

// Cloudflare Web Analytics。Beacon token はクライアントHTMLに公開される識別子であり、
// API Secretではない。変更・無効化はこの設定だけで行い、生成HTMLは直接編集しない。
export const ANALYTICS = Object.freeze({
  provider: 'cloudflare',
  enabled: true,
  token: '6473e8a5f9904585a0f0f17c8a3edfe0',
});

export const COPYRIGHT_HTML = (year) => `
        <span>&copy; ${year} TAMA.</span>
        <span class="dot" aria-hidden="true"></span>
        <span lang="en">Take it easy.</span>
        <span class="dot" aria-hidden="true"></span>
        <span lang="en">Curated for the Deaf &amp; Hard-of-hearing community.</span>`;
