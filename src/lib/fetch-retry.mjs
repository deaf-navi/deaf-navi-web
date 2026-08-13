/**
 * タイムアウト・指数バックオフ付き fetch。
 */

export const FETCH_TIMEOUT_MS = 15_000;
export const FETCH_ATTEMPTS = 3;
export const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {{timeoutMs?: number, attempts?: number, headers?: Record<string,string>}} [options]
 */
export async function fetchWithTimeout(url, options = {}) {
  const {
    timeoutMs = FETCH_TIMEOUT_MS,
    attempts = FETCH_ATTEMPTS,
    headers = {},
  } = options;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers });
      if (response.ok || !RETRYABLE_HTTP_STATUS.has(response.status) || attempt === attempts) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }

    await wait(400 * (2 ** (attempt - 1)));
  }

  throw lastError ?? new Error('フィード取得に失敗しました。');
}
