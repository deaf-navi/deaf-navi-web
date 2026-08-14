import { useCallback, useEffect, useRef, useState } from 'react'
import { SoundEngine, type AiStatus, type EngineEvent } from '../../lib/audio/engine'
import { acquireWakeLock, type WakeLockHandle } from '../../lib/wakeLock'
import { vibrateCategory } from '../../lib/vibrate'
import { loadJSON, saveJSON } from '../../lib/storage'
import { makeId } from '../../lib/format'
import { useSettings } from '../../state/settings'
import type { SoundEvent } from '../../types'

export type WatchStatus = 'idle' | 'starting' | 'running' | 'mic-denied' | 'mic-unavailable'

export interface LevelSample {
  rms: number
  peak: number
}

const HISTORY_KEY = 'otomado:soundHistory:v1'
const MAX_EVENTS = 50

export function useSoundWatch() {
  const { settings } = useSettings()
  const [status, setStatus] = useState<WatchStatus>('idle')
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [events, setEvents] = useState<SoundEvent[]>(() => loadJSON<SoundEvent[]>(HISTORY_KEY, []))
  const [activeAlert, setActiveAlert] = useState<SoundEvent | null>(null)

  const levelRef = useRef<LevelSample>({ rms: 0, peak: 0 })
  const engineRef = useRef<SoundEngine | null>(null)
  const wakeRef = useRef<WakeLockHandle | null>(null)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // 設定変更を稼働中エンジンへ反映
  useEffect(() => {
    engineRef.current?.setConfig({ sensitivity: settings.sensitivity, enabled: settings.enabled })
  }, [settings.sensitivity, settings.enabled])

  const pushEvent = useCallback((e: EngineEvent) => {
    const ev: SoundEvent = {
      id: makeId(),
      category: e.category,
      className: e.className,
      score: e.score,
      at: Date.now(),
    }
    setEvents((prev) => {
      const next = [ev, ...prev].slice(0, MAX_EVENTS)
      saveJSON(HISTORY_KEY, next)
      return next
    })
    setActiveAlert(ev)
    if (settingsRef.current.vibration) vibrateCategory(e.category)
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    // 既定は「ユーザーが閉じるまで表示」（WCAG 2.2.1）。秒数指定時のみ自動クローズ
    const secs = settingsRef.current.alertSeconds
    if (secs > 0) {
      dismissTimer.current = setTimeout(() => setActiveAlert(null), secs * 1000)
    }
  }, [])

  const start = useCallback(async () => {
    if (engineRef.current) return
    setStatus('starting')
    setAi(null)
    const engine = new SoundEngine(
      { sensitivity: settingsRef.current.sensitivity, enabled: settingsRef.current.enabled },
      {
        onLevel: (rms, peak) => {
          levelRef.current = { rms, peak }
        },
        onEvent: pushEvent,
        onAiStatus: setAi,
        onMicError: (kind) => setStatus(kind === 'denied' ? 'mic-denied' : 'mic-unavailable'),
      },
    )
    engineRef.current = engine
    let ok = false
    try {
      ok = await engine.start()
    } catch {
      ok = false // エンジン側で後始末済み
    }
    if (ok) {
      setStatus('running')
      const handle = await acquireWakeLock()
      // 取得完了前にアンマウント/停止された場合は即時解放（リーク防止）
      if (engineRef.current === engine) wakeRef.current = handle
      else handle.release()
    } else {
      engineRef.current = null
    }
  }, [pushEvent])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    wakeRef.current?.release()
    wakeRef.current = null
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    levelRef.current = { rms: 0, peak: 0 }
    setStatus('idle')
    setAi(null)
    setActiveAlert(null)
  }, [])

  const dismissAlert = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    setActiveAlert(null)
  }, [])

  const testAlert = useCallback(() => {
    pushEvent({ category: 'chime', score: 1 })
  }, [pushEvent])

  const clearHistory = useCallback(() => {
    setEvents([])
    saveJSON(HISTORY_KEY, [])
  }, [])

  // 画面離脱時は必ず停止する
  useEffect(() => stop, [stop])

  return {
    status,
    ai,
    events,
    activeAlert,
    levelRef,
    start,
    stop,
    dismissAlert,
    testAlert,
    clearHistory,
  }
}
