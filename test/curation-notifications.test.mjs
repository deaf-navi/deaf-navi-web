import test from 'node:test';
import assert from 'node:assert/strict';
import notify from '../scripts/notify-curation.cjs';

function harness(issues = [], labelStatus) {
  const calls = [];
  const record = (method) => async (args) => {
    calls.push({ method, args });
    if (method === 'label' && labelStatus) throw Object.assign(new Error('label error'), { status: labelStatus });
    return { data: { html_url: 'https://github.com/test/site/issues/1' } };
  };
  return { calls, args: {
    github: { rest: { issues: { listForRepo() {}, create: record('create'), createComment: record('comment'), createLabel: record('label') } }, paginate: async () => issues },
    context: { repo: { owner: 'test', repo: 'site' }, serverUrl: 'https://github.com', runId: 42 },
    core: { info() {} },
  } };
}

test('domestic failure creates an issue with a run link', async () => {
  const h = harness();
  await notify(h.args);
  assert.equal(h.calls[0].method, 'create');
  assert.equal(h.calls[0].args.title, 'Curation workflow needs attention');
  assert.match(h.calls[0].args.body, /actions\/runs\/42/);
});

test('World failure comments on an existing issue even when the label already exists', async () => {
  const h = harness([{ number: 9, title: 'Deaf Navi World curation requires attention' }], 422);
  await notify(h.args, { world: true });
  assert.deepEqual(h.calls.map((call) => call.method), ['label', 'comment']);
  assert.equal(h.calls[1].args.issue_number, 9);
});

test('notification tests never modify a real incident or attach a failure label', async () => {
  const h = harness([{ number: 9, title: 'Deaf Navi World curation requires attention' }]);
  await notify(h.args, { world: true, testing: true });
  assert.deepEqual(h.calls.map((call) => call.method), ['create']);
  assert.match(h.calls[0].args.title, /^\[通知テスト\]/);
  assert.equal(h.calls[0].args.labels, undefined);
});

test('notification authorization errors are not reported as delivery success', async () => {
  const h = harness([], 403);
  await assert.rejects(notify(h.args, { world: true }), /label error/);
});
