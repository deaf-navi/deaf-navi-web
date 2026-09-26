// Used by failure jobs and the manual notification test; no generation or deployment.
module.exports = async function notifyCuration({ github, context, core }, { world = false, testing = false } = {}) {
  const { owner, repo } = context.repo;
  const title = `${testing ? '[通知テスト] ' : ''}${world ? 'Deaf Navi World curation requires attention' : 'Curation workflow needs attention'}`;
  const body = [
    testing ? '通知経路の動作テストです。キュレーション障害ではありません。' : `${world ? 'World' : '国内'}キュレーションActionsが失敗しました。ログを確認してください。`,
    '',
    `Run: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
    `Time: ${new Date().toISOString()}`,
    '',
    '記事取得・翻訳・ビルド・Git pushの失敗箇所を確認してください。',
    ...(world ? [
      'Google翻訳429/5xx、pending件数、Codexによる未翻訳補完の結果を確認してください。',
      'Codexも利用できない場合は前回記事を維持します。専用PM2と認証付き /health を確認してください。',
      '/ready やsmokeは生成を実行するため、定期監視には使用しません。',
    ] : []),
    'トークン値をIssueやログに貼らないでください。復旧確認後にcloseしてください。',
  ].join('\n');
  const label = 'curation-failure';
  if (world && !testing) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name: label, color: 'd73a4a', description: 'Automated curation workflow failure' });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }
  const issues = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', per_page: 100 });
  const existing = issues.find((issue) => !issue.pull_request && issue.title === title);
  let result;
  if (existing) {
    result = await github.rest.issues.createComment({ owner, repo, issue_number: existing.number, body });
  } else {
    result = await github.rest.issues.create({ owner, repo, title, body, ...(world && !testing ? { labels: [label] } : {}) });
  }
  core.info(`Curation notification delivered: ${result.data.html_url}`);
  return result.data.html_url;
};
