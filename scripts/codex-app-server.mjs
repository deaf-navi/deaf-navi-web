import { spawn } from 'node:child_process';
import http from 'node:http';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const port = Number(argValue('--port') ?? process.env.CODEX_APP_SERVER_PORT ?? 8787);
const host = String(argValue('--host') ?? process.env.CODEX_APP_SERVER_HOST ?? '127.0.0.1').trim();
const token = String(argValue('--token') ?? process.env.CODEX_APP_SERVER_TOKEN ?? '').trim();
const requireToken = process.env.CODEX_APP_SERVER_REQUIRE_TOKEN !== '0';
const codexBin = String(process.env.CODEX_BIN ?? 'codex').trim();
const model = String(process.env.CODEX_APP_SERVER_MODEL ?? '').trim();
const timeoutMs = Number(process.env.CODEX_APP_SERVER_EXEC_TIMEOUT_MS ?? 180_000);
const outputLimitBytes = 1024 * 1024 * 4;
const requestLimitBytes = Number(process.env.CODEX_APP_SERVER_REQUEST_LIMIT_BYTES ?? 768_000);
const maxBatchItems = Number(process.env.CODEX_APP_SERVER_MAX_BATCH_ITEMS ?? 50);
const allowedTypes = new Set(
  (process.env.CODEX_APP_SERVER_ALLOWED_TYPES ?? 'world_jp_post_edit')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

if (requireToken && !token) {
  throw new Error('CODEX_APP_SERVER_TOKEN is required when CODEX_APP_SERVER_REQUIRE_TOKEN is enabled');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
    if (size > requestLimitBytes) throw httpError(413, 'request body too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validateRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw httpError(400, 'request body must be an object');
  if (!allowedTypes.has(String(body.type ?? ''))) throw httpError(400, 'request type is not allowed');
  if (body.platform !== 'deaf-navi-world-jp') throw httpError(400, 'platform is not allowed');
  const count = Number(body.count ?? 1);
  if (!Number.isFinite(count) || count < 1 || count > maxBatchItems) throw httpError(400, 'count is out of range');
  if (typeof body.source_text !== 'string' || body.source_text.length < 2) throw httpError(400, 'source_text is required');
  if (body.source_text.length > requestLimitBytes) throw httpError(413, 'source_text is too large');
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
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 1200) return compact;
  return `${compact.slice(0, 500)} ... ${compact.slice(-700)}`;
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
      env: safeCodexEnv(),
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

function safeCodexEnv() {
  const pass = [
    'PATH',
    'Path',
    'HOME',
    'USERPROFILE',
    'USER',
    'USERNAME',
    'SHELL',
    'ComSpec',
    'SystemRoot',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'TERM',
    'APPDATA',
    'LOCALAPPDATA',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
    'CODEX_HOME',
  ];
  const env = {};
  for (const key of pass) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

async function generate(body) {
  validateRequestBody(body);
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
      if (!authorized(req)) {
        sendJson(res, 401, { success: false, error: 'unauthorized' });
        return;
      }
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
    const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    sendJson(res, statusCode, { success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(port, host, () => {
  console.log(`codex_app_server listening on http://${host}:${port}`);
});
