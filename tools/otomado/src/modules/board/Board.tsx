import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettings } from '../../state/settings'
import { AutoFitText } from './AutoFitText'
import { IconFlip, IconPlus, IconX } from '../../components/icons'
import {
  addPhrase,
  loadBoardHistory,
  loadPhrases,
  pushHistory,
  removePhraseAt,
  saveBoardHistory,
  savePhrases,
} from './phrases'

export function Board() {
  const { settings, t } = useSettings()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'compose' | 'show'>('compose')
  const [displayText, setDisplayText] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [phrases, setPhrases] = useState<string[]>(() => loadPhrases(settings.lang))
  const [editing, setEditing] = useState(false)
  const [history, setHistory] = useState<string[]>(loadBoardHistory)
  const [announce, setAnnounce] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const flipBtnRef = useRef<HTMLButtonElement>(null)

  // 反転状態は表示のたびにリセットしない — 窓口での連続筆談で毎回反転し直すのを防ぐ
  const show = useCallback((value: string) => {
    const v = value.trim()
    if (!v) return
    setDisplayText(v)
    setMode('show')
    setHistory((prev) => {
      const next = pushHistory(prev, v)
      saveBoardHistory(next)
      return next
    })
  }, [])

  const back = useCallback(() => {
    setMode('compose')
    setAnnounce('')
    // 表示前に書いていた続きから編集できるようフォーカスを戻す
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [])

  const clearAndBack = useCallback(() => {
    setText('')
    back()
  }, [back])

  const toggleFlip = () => {
    setFlipped((f) => {
      setAnnounce(t(f ? 'a11y.unflipped' : 'a11y.flipped'))
      return !f
    })
  }

  const addCurrent = () => {
    setPhrases((prev) => {
      const next = addPhrase(prev, text)
      if (next !== prev) savePhrases(next)
      return next
    })
  }

  const removeAt = (index: number) => {
    setPhrases((prev) => {
      const next = removePhraseAt(prev, index)
      savePhrases(next)
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    saveBoardHistory([])
  }

  // 表示モード: Esc で戻る・フォーカスをダイアログ内に閉じ込める
  useEffect(() => {
    if (mode !== 'show') return
    flipBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        back()
        return
      }
      if (e.key === 'Tab') {
        const overlay = overlayRef.current
        if (!overlay) return
        const focusables = overlay.querySelectorAll<HTMLElement>('button')
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, back])

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('nav.board')}</h1>
        <p>{t('board.desc')}</p>
      </header>

      <section className="card">
        <label htmlFor="board-input" className="visually-hidden">
          {t('nav.board')}
        </label>
        <textarea
          id="board-input"
          ref={textareaRef}
          className="board-input"
          value={text}
          rows={4}
          placeholder={t('board.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              show(text)
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-xl"
          disabled={!text.trim()}
          onClick={() => show(text)}
        >
          {t('board.show')}
        </button>
        <p className="hint">{t('board.showHint')}</p>
      </section>

      <section className="card" aria-labelledby="phrases-heading">
        <div className="card-heading-row">
          <h2 id="phrases-heading" className="card-heading">
            {t('board.phrases')}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
          >
            {editing ? t('board.donePhrases') : t('board.editPhrases')}
          </button>
        </div>
        <ul className="phrase-list">
          {phrases.map((phrase, i) => (
            <li key={`${phrase}-${i}`}>
              {editing ? (
                <span className="phrase-chip editing">
                  <span className="phrase-text">{phrase}</span>
                  <button
                    type="button"
                    className="phrase-remove"
                    onClick={() => removeAt(i)}
                    aria-label={t('board.removePhrase', { text: phrase })}
                  >
                    <IconX size={16} />
                  </button>
                </span>
              ) : (
                <button type="button" className="phrase-chip" onClick={() => show(phrase)}>
                  {phrase}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={addCurrent}
          disabled={!text.trim()}
        >
          <IconPlus size={18} />
          {t('board.addPhrase')}
        </button>
      </section>

      <section className="card" aria-labelledby="board-history-heading">
        <div className="card-heading-row">
          <h2 id="board-history-heading" className="card-heading">
            {t('board.history')}
          </h2>
          {history.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearHistory}>
              {t('board.historyClear')}
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="empty-note">{t('board.historyEmpty')}</p>
        ) : (
          <ul className="phrase-list">
            {history.map((item, i) => (
              <li key={`${item}-${i}`}>
                <button type="button" className="phrase-chip" onClick={() => show(item)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mode === 'show' && (
        <div
          ref={overlayRef}
          className="board-show"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.board')}
        >
          <div className={flipped ? 'board-show-stage flipped' : 'board-show-stage'}>
            <AutoFitText text={displayText} />
          </div>
          <div className="board-show-controls">
            <button
              ref={flipBtnRef}
              type="button"
              className="btn btn-ghost"
              onClick={toggleFlip}
              aria-pressed={flipped}
            >
              <IconFlip size={20} />
              {t('board.flip')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearAndBack}>
              <IconX size={20} />
              {t('board.clearShow')}
            </button>
            <button type="button" className="btn btn-primary" onClick={back}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
      <div aria-live="polite" className="visually-hidden">
        {announce}
      </div>
    </div>
  )
}
