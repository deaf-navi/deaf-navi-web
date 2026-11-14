import { escapeHtml as e } from '../lib/text.mjs';

// Keep distinct announcement / booking / PDF URLs, but link an identical destination once.
export function renderEventSource(event, { newTabLabel = false } = {}) {
  const label = `${event.sourceName}の告知`;
  if (new URL(event.sourceUrl).href === new URL(event.detailUrl || event.sourceUrl).href) {
    return `<span>${e(label)}</span>`;
  }
  return `<a href="${e(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${e(label)}${newTabLabel ? '（新しいタブ）' : ''}</a>`;
}
