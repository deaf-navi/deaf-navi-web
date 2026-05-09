import { spawn } from 'node:child_process';
import http from 'node:http';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const port = Number(argValue('--port') ?? process.env.CODEX_APP_SERVER_PORT ?? 8787);
const host = argValue('--host') ?? process.env.CODEX_APP_SERVER_HOST ?? '127.0.0.1';
const token = argValue('--token') ?? process.env.CODEX_APP_SERVER_TOKEN ?? '';
const codexBin = process.env.CODEX_BIN ?? 'codex';
const model = process.env.CODEX_APP_SERVER_MODEL ?? '';
const timeoutMs = Number(process.env.CODEX_APP_SERVER_EXEC_TIMEOUT_MS ?? 180_000);
const outputLimitBytes = 1024 * 1024 * 4;

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!token) return true;
  const auth = req.headers.authorization ?? '';
  const bearer = Array.isArray(auth) ? auth[0] : auth;
  const headerToken = req.headers['x-codex-app-token'];
  return bearer === `Bearer ${token}` || headerToken === token;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 768_000) throw new Error('request body too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function buildPrompt(body) {
  return [
    'You are the Codex App Server text backend for Deaf Navi Web.',
    'Do not browse the web, inspect files, or call external tools.',
    'Generate text only from the request payload.',
    'Return only JSON. Do not wrap it in Markdown.',
    '',
    '# Required response shape',
    JSON.stringify({
      success: true,
      provider: 'codex_app_server',
      items: [
        {
          id: 'same id as request item',
          title: 'edited title',
          summary: 'edited summary',
        },
      ],
    }, null, 2),
    '',
    '# Request',
    JSON.stringify({
      type: body.type,
      tone: body.tone,
      platform: body.platform,
      count: body.count ?? 1,
      metadata: body.metadata ?? {},
      source_text: body.source_text ?? null,
    }, null, 2),
    '',
    '# System prompt',
    body.system_prompt ?? '',
    '',
    '# User prompt',
    body.user_prompt ?? '',
  ].join('\n');
}

function extractJson(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function compactError(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function runCodex(prompt) {
  const args = [
    'exec',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
  ];
  if (model) args.push('--model', model);
  args.push('-');

  return new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout, 'utf8') > outputLimitBytes) child.kill('SIGTERM');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (Buffer.byteLength(stderr, 'utf8') > outputLimitBytes) child.kill('SIGTERM');
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`codex exec failed (${signal ? `signal ${signal}` : `exit ${code}`}): ${compactError(stderr || stdout)}`));
    });

    child.stdin.end(prompt);
  });
}

async function generate(body) {
  const prompt = buildPrompt(body);
  const stdout = await runCodex(prompt);
  const parsed = JSON.parse(extractJson(stdout));
  const items = Array.isArray(parsed.items)
    ? parsed.items
    : [
        {
          id: parsed.id ?? '0',
          title: parsed.title ?? null,
          summary: parsed.summary ?? parsed.body_excerpt ?? parsed.body ?? parsed.text ?? null,
        },
      ];
  return {
    success: parsed.success !== false,
    provider: 'codex_app_server',
    items,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, provider: 'codex_app_server' });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/generate') {
      sendJson(res, 404, { success: false, error: 'not found' });
      return;
    }

    if (!authorized(req)) {
      sendJson(res, 401, { success: false, error: 'unauthorized' });
      return;
    }

    const body = await readJson(req);
    const result = await generate(body);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(port, host, () => {
  console.log(`codex_app_server listening on http://${host}:${port}`);
});
