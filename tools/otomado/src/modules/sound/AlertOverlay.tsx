import { useEffect, useRef } from 'react'
import { CategoryIcon } from '../../components/icons'
import { useSettings } from '../../state/settings'
import { formatTime } from '../../lib/format'
import type { MsgKey } from '../../i18n'
import type { SoundEvent } from '../../types'

/**
 * 全画面アラート。ゆっくり明滅（1Hz・WCAG 2.3.1 の3回/秒制限内）＋
 * カテゴリ色＋アイコン＋大ラベルで冗長に伝える。
 * どこをタップ/クリックしても、Esc でも閉じられる。
 * 表示中はフォーカスをオーバーレイに移して背後のUI誤操作を防ぎ、閉じたら元へ戻す。
 */
export function AlertOverlay({ event, onDismiss }: { event: SoundEvent; onDismiss: () => void }) {
  const { settings, t } = useSettings()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    btnRef.current?.focus()
    return () => {
      if (prev && prev.isConnected) prev.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss()
      } else if (e.key === 'Tab') {
        // フォーカス可能要素はオーバーレイ1つだけ — 背後への移動を止める
        e.preventDefault()
        btnRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const name = t(`cat.${event.category}` as MsgKey)

  return (
    <button
      ref={btnRef}
      type="button"
      className="alert-overlay"
      data-category={event.category}
      onClick={onDismiss}
    >
      <span className="alert-icon" aria-hidden="true">
        <CategoryIcon category={event.category} size={96} />
      </span>
      <span className="alert-label">{name}</span>
      <span className="alert-time">{formatTime(event.at, settings.lang)}</span>
      {event.className && <span className="alert-class">{event.className}</span>}
      <span className="alert-dismiss">{t('common.close')}</span>
    </button>
  )
}
