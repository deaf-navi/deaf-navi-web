import { ANALYTICS } from '../../config/site.mjs';

export const CLOUDFLARE_ANALYTICS_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * Analyticsを有効として出力できる設定かを判定する。
 * 不完全・未知の設定はサイト公開を止めず、Beaconを出力しない。
 */
export function isCloudflareAnalyticsEnabled(config = ANALYTICS) {
  return config?.enabled === true
    && config?.provider === 'cloudflare'
    && typeof config?.token === 'string'
    && /^[A-Za-z0-9._~-]+$/.test(config.token);
}

/** Cloudflare Dashboardが案内する手動埋め込み形式を生成する。 */
export function renderCloudflareAnalyticsBeacon(config = ANALYTICS) {
  if (!isCloudflareAnalyticsEnabled(config)) return '';
  const data = JSON.stringify({ token: config.token });
  return `<script type="module" src="${CLOUDFLARE_ANALYTICS_BEACON_URL}" data-cf-beacon='${data}'></script>`;
}

/**
 * 有効なHTMLの </body> 直前へBeaconを1回だけ挿入する。
 * HTML不正・Analytics無効・既に挿入済みの場合は入力をそのまま返す。
 */
export function injectCloudflareAnalytics(html, config = ANALYTICS) {
  const beacon = renderCloudflareAnalyticsBeacon(config);
  if (!beacon || typeof html !== 'string' || html.includes(CLOUDFLARE_ANALYTICS_BEACON_URL)) {
    return html;
  }
  if (!/<\/body\s*>/i.test(html)) return html;
  return html.replace(/([ \t]*)<\/body\s*>/i, (_, indent) => `${indent}  ${beacon}\n${indent}</body>`);
}
