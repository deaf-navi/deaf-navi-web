/**
 * Screen Wake Lock API のラッパー。
 * 監視中に画面が消えるとアラートが見えないため、可能なら画面を起こしたままにする。
 * 非対応環境では何もしない（機能はそのまま動く）。
 */
export interface WakeLockHandle {
  release: () => void
}

export async function acquireWakeLock(): Promise<WakeLockHandle> {
  let sentinel: WakeLockSentinel | null = null
  let active = true

  const request = async () => {
    if (!active || !('wakeLock' in navigator)) return
    try {
      const s = await navigator.wakeLock.request('screen')
      // 取得中に release() が走った場合は即解放（解放漏れレース防止）
      if (!active) {
        void s.release().catch(() => undefined)
        return
      }
      sentinel = s
    } catch {
      sentinel = null // 省電力モード等で拒否されることがある
    }
  }

  // タブ復帰時に再取得（バックグラウンドに回ると自動解放されるため）
  const onVisible = () => {
    if (document.visibilityState === 'visible') void request()
  }
  document.addEventListener('visibilitychange', onVisible)
  await request()

  return {
    release: () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
      sentinel = null
    },
  }
}
