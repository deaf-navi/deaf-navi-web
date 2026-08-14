import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSettings } from '../../state/settings'
import { clampScale } from '../../state/settings'
import {
  CaptionEngine,
  isSpeechSupported,
  type CaptionError,
} from '../../lib/speech/recognition'
import { captionsReducer, initialCaptionsState } from './reducer'
import { acquireWakeLock, type WakeLockHandle } from '../../lib/wakeLock'
import { IconArrowDown, IconCopy } from '../../components/icons'
import { routeToHash } from '../../router'

/** 段階 1..6 → フォントサイズ(rem) */
export const CAPTION_SIZES = [1.375, 1.75, 2.25, 3, 3.75, 4.5]

export function Captions() {
  const { settings, update, t } = useSettings()
  const [state, dispatch] = useReducer(captionsReducer, initialCaptionsState)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<CaptionError | null>(null)
  const [copied, setCopied] = useState(false)
  const [recLang, setRecLang] = useState(settings.lang === 'en' ? 'en-US' : 'ja-JP')

  const engineRef = useRef<CaptionEngine | null>(null)
  const wakeRef = useRef<WakeLockHandle | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const supported = useMemo(() => isSpeechSupported(), [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    wakeRef.current?.release()
    wakeRef.current = null
  }, [])

  const start = useCallback(
    (lang: string) => {
      // エラー後の再開などで前回分のエンジン・WakeLock が残っていても必ず解放してから始める
      stop()
      setError(null)
      const engine = new CaptionEngine({
        onFinal: (text) => dispatch({ type: 'final', text }),
        onInterim: (text) => dispatch({ type: 'interim', text }),
        onListeningChange: setListening,
        onError: (err) => {
          setError(err)
          setListening(false)
          // エラーで停止した場合も WakeLock を確実に解放する（画面点きっぱなし防止）
          if (engineRef.current === engine) {
            engineRef.current = null
            wakeRef.current?.release()
            wakeRef.current = null
          }
        },
      })
      engineRef.current = engine
      engine.start(lang)
      void acquireWakeLock().then((handle) => {
        if (engineRef.current === engine) {
          wakeRef.current?.release()
          wakeRef.current = handle
        } else {
          handle.release()
        }
      })
    },
    [dispatch, stop],
  )

  useEffect(() => stop, [stop])

  const switchLang = (lang: string) => {
    setRecLang(lang)
    if (listening) {
      stop()
      start(lang)
    }
  }

  // 新しい字幕が来たら（最下部にいる場合のみ）自動スクロール
  useEffect(() => {
    const el = areaRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [state])

  const onScroll = () => {
    const el = areaRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    atBottomRef.current = nearBottom
    setAtBottom(nearBottom)
  }

  const jumpToLatest = () => {
    const el = areaRef.current
    if (el) el.scrollTop = el.scrollHeight
    atBottomRef.current = true
    setAtBottom(true)
  }

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(state.finals.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボード不可の環境では黙って何もしない
    }
  }

  const scale = clampScale(settings.captionScale)
  const fontSize = `${CAPTION_SIZES[scale - 1]}rem`

  if (!supported) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>{t('nav.captions')}</h1>
        </header>
        <section className="card">
          <p className="error-note">{t('captions.unsupported')}</p>
          <a className="btn btn-primary btn-xl" href={routeToHash('board')}>
            {t('captions.goBoard')}
          </a>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('nav.captions')}</h1>
        <p>{t('captions.desc')}</p>
      </header>

      <section className="card cap-controls">
        {listening ? (
          <button type="button" className="btn btn-stop btn-xl" onClick={stop}>
            {t('captions.stop')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-xl" onClick={() => start(recLang)}>
            {t('captions.start')}
          </button>
        )}

        {listening && (
          <p className="sound-status">
            <span className="live-dot" aria-hidden="true" />
            {t('captions.listening')}
          </p>
        )}
        {error === 'network' && (
          <p className="error-note" role="alert">
            {t('captions.error.network')}
          </p>
        )}
        {error === 'not-allowed' && (
          <p className="error-note" role="alert">
            {t('captions.error.notAllowed')}
          </p>
        )}

        <div className="cap-toolbar">
          <fieldset className="lang-toggle">
            <legend className="visually-hidden">{t('captions.langLabel')}</legend>
            <label className={recLang === 'ja-JP' ? 'lang-option selected' : 'lang-option'}>
              <input
                type="radio"
                name="rec-lang"
                checked={recLang === 'ja-JP'}
                onChange={() => switchLang('ja-JP')}
              />
              {t('captions.lang.ja')}
            </label>
            <label className={recLang === 'en-US' ? 'lang-option selected' : 'lang-option'}>
              <input
                type="radio"
                name="rec-lang"
                checked={recLang === 'en-US'}
                onChange={() => switchLang('en-US')}
              />
              {t('captions.lang.en')}
            </label>
          </fieldset>

          <div className="font-stepper" role="group" aria-label={t('captions.fontSize')}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => update({ captionScale: scale - 1 })}
              disabled={scale <= 1}
              aria-label={t('captions.smaller')}
            >
              A−
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => update({ captionScale: scale + 1 })}
              disabled={scale >= CAPTION_SIZES.length}
              aria-label={t('captions.bigger')}
            >
              A＋
            </button>
          </div>
        </div>
      </section>

      <div className="cap-area-wrap">
        <div
          ref={areaRef}
          role="log"
          className="cap-area"
          style={{ fontSize }}
          onScroll={onScroll}
          tabIndex={0}
          aria-label={t('nav.captions')}
        >
          {state.finals.length === 0 && !state.interim && (
            <p className="cap-placeholder">{t('captions.placeholder')}</p>
          )}
          {state.finals.map((line, i) => (
            <p key={i} className="cap-line">
              {line}
            </p>
          ))}
          {state.interim && <p className="cap-line cap-interim">{state.interim}</p>}
        </div>
        {!atBottom && (
          <button type="button" className="btn btn-primary btn-sm cap-jump" onClick={jumpToLatest}>
            <IconArrowDown size={18} />
            {t('captions.latest')}
          </button>
        )}
      </div>

      <div className="cap-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => dispatch({ type: 'clear' })}
          disabled={state.finals.length === 0 && !state.interim}
        >
          {t('captions.clear')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void copyAll()}
          disabled={state.finals.length === 0}
        >
          <IconCopy size={18} />
          {copied ? t('captions.copied') : t('captions.copy')}
        </button>
      </div>

      <p className="privacy-note">{t('captions.privacy')}</p>
      {/* 稼働状態の通知は常設のライブリージョンで行う（内容ごと新規挿入だとSRが読まないため） */}
      <div aria-live="polite" className="visually-hidden">
        {listening ? t('captions.listening') : ''}
      </div>
    </div>
  )
}
