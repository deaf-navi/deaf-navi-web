import { EDITORIAL_POLICY as policy } from '../../config/editorial.mjs';

export function selectEditorialNotes(notes, now = Date.now()) {
  if (!Array.isArray(notes)) return [];
  return notes.filter((note) => {
    if (!note || typeof note !== 'object') return false;
    const reviewed = Date.parse(note.reviewedAt);
    const expires = Date.parse(note.expiresAt);
    let source;
    try { source = new URL(note.sourceUrl); } catch { return false; }
    const published = Date.parse(note.publishedAt);
    const autoValid = note.mode !== 'primary-excerpt' || (
      Number.isFinite(published) && published <= reviewed
      && expires <= published + policy.maxAgeMs
      && expires <= reviewed + policy.recheckWithinMs
      && /^[a-f0-9]{64}$/.test(note.bodySha256 || ''));
    return autoValid && note.id && note.title && note.text && note.sourceName
      && source.protocol === 'https:' && !source.username && !source.password
      && Number.isFinite(reviewed) && Number.isFinite(expires)
      && reviewed <= now && now < expires && expires - reviewed <= 14 * 86_400_000;
  }).slice(0, 2);
}
