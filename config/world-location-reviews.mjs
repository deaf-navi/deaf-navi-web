import {readFileSync} from 'node:fs';
// Source-specific review data. Do not edit generated docs JSON.
// Human entries require an exact original-title/summary quote. AI-assisted
// entries require dated source references, both reviewers, and an audit digest.
// Both are bound to sourceFingerprint; changed originals invalidate the entry.
// AI-assisted records are never represented as human editorial approval.
export const WORLD_LOCATION_REVIEWS = JSON.parse(readFileSync(new URL('./world-location-source-reviews.json',import.meta.url),'utf8')).entries;
