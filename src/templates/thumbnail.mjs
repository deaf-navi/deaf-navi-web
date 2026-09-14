import { imageUrl } from '../lib/thumbnail-metadata.mjs';

export function renderThumbnail(article) {
  const url = imageUrl(article.thumbnail?.url);
  if (!url) return '';
  const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<img class="card__thumbnail" src="${escaped}" alt="" width="112" height="84" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}
