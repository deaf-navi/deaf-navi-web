import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { updateEditorial } from './lib/editorial-update.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('docs/articles.json', root), 'utf8'));
if (!Array.isArray(data.articles)) throw new Error('Domestic article snapshot is missing');
const result = await updateEditorial(data.articles);
const directory = new URL('.state/', root);
await mkdir(directory, { recursive: true });
const target = new URL('editorial.json', directory);
const temp = fileURLToPath(target) + '.tmp';
await writeFile(temp, JSON.stringify(result, null, 2) + '\n', 'utf8');
await rename(temp, target);
console.log('Editorial: ' + result.notes.length + ' note; ' + result.checks.length + ' primary pages checked');
for (const check of result.checks) console.log('  ' + check.reason + ': ' + check.sourceUrl);
if (!result.notes.length && result.checks.some(c => ['fetch-failed', 'http-status'].includes(c.reason))) {
  console.warn('::warning::Editorial source verification failed; no previous note was retained.');
}
