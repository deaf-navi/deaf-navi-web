// Local/backfill entry point: no curation, translation, account or paid API calls.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { enrichNewsThumbnails } from '../src/lib/news-thumbnails.mjs';

const args = process.argv.slice(2);
const edition = args.find((arg) => arg.startsWith('--edition='))?.split('=')[1] || 'domestic';
if (!['domestic', 'world'].includes(edition)) throw new Error('Expected --edition=domestic or --edition=world');
const limit = Number(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 60);
const seconds = Number(args.find((arg) => arg.startsWith('--seconds='))?.split('=')[1] || 90);
if (!Number.isInteger(limit) || limit < 0 || limit > 600 || !Number.isFinite(seconds) || seconds < 1 || seconds > 600) {
  throw new Error('Expected limit 0..600 and seconds 1..600');
}
const write = args.includes('--write');
const dataFile = new URL(edition === 'world' ? '../docs/articles-world.json' : '../docs/articles.json', import.meta.url);
const data = JSON.parse(await readFile(dataFile, 'utf8'));
const before = data.articles.map(({ thumbnail, ...article }) => article);
const report = await enrichNewsThumbnails(data.articles, {
  cacheFile: write ? fileURLToPath(new URL(`../.state/thumbnails-${edition}.json`, import.meta.url)) : undefined,
  maxArticles: limit, budgetMs: seconds * 1000, userAgent: 'Codex-DeafNavi-Verification',
});
if (JSON.stringify(before) !== JSON.stringify(data.articles.map(({ thumbnail, ...article }) => article))) {
  throw new Error('Non-thumbnail article data changed');
}
if (write) await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
console.log(JSON.stringify({ edition, write, ...report }, null, 2));
