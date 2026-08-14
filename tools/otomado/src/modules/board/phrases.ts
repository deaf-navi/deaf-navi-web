import type { Lang } from '../../types'
import { loadJSON, saveJSON } from '../../lib/storage'

export const PHRASES_KEY = 'otomado:phrases:v1'
export const BOARD_HISTORY_KEY = 'otomado:boardHistory:v1'

export const MAX_PHRASES = 30
export const MAX_HISTORY = 30

export function defaultPhrases(lang: Lang): string[] {
  if (lang === 'en') {
    return [
      'I am deaf / hard of hearing.',
      'Please write it down.',
      'Please speak slowly and clearly.',
      'One more time, please.',
      'Thank you!',
      'Yes',
      'No',
    ]
  }
  return [
    '耳が聞こえません。筆談でお願いします',
    'ゆっくり、はっきり話してください',
    'もう一度お願いします',
    'ありがとうございます',
    'はい',
    'いいえ',
    '書いてもらえますか？',
  ]
}

export function loadPhrases(lang: Lang): string[] {
  return loadJSON<string[]>(PHRASES_KEY, defaultPhrases(lang))
}

export function savePhrases(phrases: string[]): void {
  saveJSON(PHRASES_KEY, phrases)
}

/** 追加: 前後空白除去・重複排除・上限あり。変更がなければ同じ配列を返す。 */
export function addPhrase(phrases: string[], text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed || phrases.includes(trimmed) || phrases.length >= MAX_PHRASES) return phrases
  return [...phrases, trimmed]
}

export function removePhraseAt(phrases: string[], index: number): string[] {
  if (index < 0 || index >= phrases.length) return phrases
  return phrases.filter((_, i) => i !== index)
}

export function loadBoardHistory(): string[] {
  return loadJSON<string[]>(BOARD_HISTORY_KEY, [])
}

export function saveBoardHistory(history: string[]): void {
  saveJSON(BOARD_HISTORY_KEY, history)
}

/** 履歴先頭に追加（直前と同じなら追加しない）。新しい順。 */
export function pushHistory(history: string[], text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed || history[0] === trimmed) return history
  const next = [trimmed, ...history.filter((h) => h !== trimmed)]
  if (next.length > MAX_HISTORY) next.length = MAX_HISTORY
  return next
}
