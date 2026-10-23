import {createHash} from 'node:crypto';
// Public IDs, URLs and a digest only. Never export private curation excerpts.
export const lodgingPublicationHash=record=>createHash('sha256').update(JSON.stringify(record)).digest('hex');
export function lodgingSnapshot(records){
  return {version:1,records:records.map(record=>({id:record.id,
    sourceUrls:[...new Set([record.bookingUrl,...(record.sources??[]).map(s=>s.url)])],
    publicationHash:lodgingPublicationHash(record)}))};
}
