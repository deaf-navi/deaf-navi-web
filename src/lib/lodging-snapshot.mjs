import {createHash} from 'node:crypto';
// Public IDs, URLs and a digest only. Never export private curation excerpts.
export const lodgingPublicationHash=record=>createHash('sha256').update(JSON.stringify(record)).digest('hex');
// Only the reference-article list is presentation-only. All unknown keys and
// booking, source, price, accessibility and freshness fields remain protected.
export function lodgingComparisonHash(record){
  const {media,...conditions}=record;
  return lodgingPublicationHash(conditions);
}
export function lodgingSnapshot(records){
  return {version:1,records:records.map(record=>({id:record.id,
    sourceUrls:[...new Set([record.bookingUrl,...(record.sources??[]).map(s=>s.url)])],
  referenceUrls:[...new Set((record.media??[]).map(s=>s.url))],
    publicationHash:lodgingPublicationHash(record),comparisonVersion:1,comparisonHash:lodgingComparisonHash(record)}))};
}
