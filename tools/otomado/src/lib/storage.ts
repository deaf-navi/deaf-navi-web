/** localStorage の安全なラッパー。壊れたJSON・容量超過・プライベートモードでも落ちない。 */

export const STORAGE_PREFIX = 'otomado:'

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 容量超過・プライベートモード等は黙って無視（アプリはメモリ上で動き続ける）
  }
}

/** otomado: プレフィックスの全データを消去する（設定リセット用） */
export function clearAllAppData(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    // noop
  }
}
