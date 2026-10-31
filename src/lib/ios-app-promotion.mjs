import config from '../../server/ios-app-promotion.json' with { type: 'json' };
import { escapeHtml } from './text.mjs';

// Public settings only. Never fabricate Apple's provider token.
export function renderIosAppBanner(canonical, robots = 'index,follow') {
  const path = new URL(canonical, 'https://deafnavi.com').pathname;
  if (/noindex/i.test(robots) || /^\/(?:otomado|admin|submit|go)(?:\/|$)/.test(path)
      || /^\/(?:404|offline)(?:\.html)?$/.test(path)) return '';
  const campaign = config.providerToken && /^\d+$/.test(config.providerToken)
    ? `, affiliate-data=pt=${config.providerToken}&ct=web_banner&mt=8` : '';
  return `<meta name="apple-itunes-app" content="${escapeHtml(`app-id=${config.appId}${campaign}`)}">`;
}
