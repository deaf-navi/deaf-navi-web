const baseUrl = String(process.env.CODEX_APP_SERVER_URL ?? `http://127.0.0.1:${process.env.CODEX_APP_SERVER_PORT ?? 8789}`).replace(/\/+$/, '');
const token = String(process.env.CODEX_APP_SERVER_TOKEN ?? '').trim();
const timeoutMs = Number(process.env.CODEX_APP_SERVER_SMOKE_TIMEOUT_MS ?? 120_000);

function headers() {
  const result = {};
  if (token) {
    result.authorization = `Bearer ${token}`;
    result['x-codex-app-token'] = token;
  }
  return result;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function check(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetchWithTimeout(url, { headers: headers() });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${path} failed: HTTP ${response.status} ${JSON.stringify(json)}`);
  }
  console.log(`${path} ok: ${JSON.stringify(json)}`);
}

await check('/health');
await check('/ready');
