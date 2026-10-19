import { NEWS_SECTIONS } from '../../config/news-sections.mjs';
import { escapeHtml } from '../lib/text.mjs';

export function renderNewsNavigation(current = 'all') {
  const items = [{ slug: 'all', label: 'すべて', href: '/' },
    ...NEWS_SECTIONS.map(section => ({ ...section, href: `/news/${section.slug}/` }))];
  return `<nav class="news-navigation" aria-label="ニュースの分野">${items.map(item => `<a href="${item.href}"${item.slug === current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`).join('')}</nav>`;
}
