export function selectEditorialNotes(notes, now = Date.now()) {
  return notes.filter((note) => {
    const reviewed = Date.parse(note.reviewedAt);
    const expires = Date.parse(note.expiresAt);
    let source;
    try { source = new URL(note.sourceUrl); } catch { return false; }
    return note.id && note.title && note.text && note.sourceName
      && source.protocol === 'https:' && !source.username && !source.password
      && Number.isFinite(reviewed) && Number.isFinite(expires)
      && reviewed <= now && now < expires && expires - reviewed <= 14 * 86_400_000;
  }).slice(0, 2);
}
