import { imageUrl } from '../lib/thumbnail-metadata.mjs';
import { CATEGORY_UI } from '../../config/categories.mjs';
import { escapeHtml } from '../lib/text.mjs';

export function renderNewsThumbnail(article) {
  return `<span class="news-media" aria-hidden="true"><span class="news-media__fallback">${escapeHtml((CATEGORY_UI[article.category] || 'ニュース').split('・')[0])}</span>${renderThumbnail(article)}</span>`;
}

export function renderThumbnail(article) {
  const url = imageUrl(article.thumbnail?.url);
  if (!url) return '';
  const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<img class="card__thumbnail" src="${escaped}" alt="" width="112" height="84" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}
