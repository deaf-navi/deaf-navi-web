import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildGitHubPagesCompat,
  NEW_BASE,
  REDIRECT_JS,
  targetForHtml,
} from '../scripts/build-github-pages-compat.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

test('GitHub Pages互換成果物はHTMLだけを転送し、iOS JSONを保持する', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'deaf-navi-pages-'));
  const output = join(temp, '_site');
  try {
    const result = await buildGitHubPagesCompat({
      sourceDir: join(root, 'docs'),
      outputDir: output,
    });
    assert.ok(result.htmlCount > 10);

    const index = await readFile(join(output, 'index.html'), 'utf8');
    assert.match(index, /rel="canonical" href="https:\/\/deafnavi\.com\/"/);
    assert.match(index, /http-equiv="refresh" content="0; url=https:\/\/deafnavi\.com\/"/);
    assert.match(index, /\/deaf-navi-web\/redirect\.js/);

    const sourceJson = await readFile(join(root, 'docs', 'app', 'v1', 'ios-news-v2.json'));
    const compatJson = await readFile(join(output, 'app', 'v1', 'ios-news-v2.json'));
    assert.deepEqual(compatJson, sourceJson);

    const redirectJs = await readFile(join(output, 'redirect.js'), 'utf8');
    assert.equal(redirectJs, REDIRECT_JS);
    assert.match(redirectJs, /location\.search/);
    assert.match(redirectJs, /location\.hash/);
    assert.match(redirectJs, /location\.replace\(target\.href\)/);

    const robots = await readFile(join(output, 'robots.txt'), 'utf8');
    assert.match(robots, /Allow: \//);
    assert.match(robots, /Sitemap: https:\/\/deafnavi\.com\/sitemap\.xml/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('転送先はHTMLのパスを独自ドメイン直下へ写す', () => {
  assert.equal(targetForHtml('index.html'), NEW_BASE);
  assert.equal(targetForHtml('guide.html'), `${NEW_BASE}guide.html`);
  assert.equal(targetForHtml(join('otomado', 'index.html')), `${NEW_BASE}otomado/`);
  assert.equal(targetForHtml(join('archive', '2026-08.html')), `${NEW_BASE}archive/2026-08.html`);
});
