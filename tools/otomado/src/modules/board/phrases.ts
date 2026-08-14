import type { Lang } from '../../types'
import { loadJSON, saveJSON } from '../../lib/storage'

export const LEGACY_PHRASES_KEY = 'otomado:phrases:v1'
export const PHRASES_KEYS: Record<Lang, string> = {
  ja: 'otomado:phrases:ja:v2',
  en: 'otomado:phrases:en:v2',
}
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

export function phrasesKey(lang: Lang): string {
  return PHRASES_KEYS[lang]
}

function readPhraseList(key: string): string[] | null {
  const value = loadJSON<unknown>(key, null)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value.slice(0, MAX_PHRASES)
}

function removeStoredValue(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 保存領域が使えなくても、既定の定型文で利用を続ける
  }
}

function inferLegacyLanguage(phrases: string[], fallback: Lang): Lang {
  if (phrases.some((phrase) => /[\u3040-\u30ff\u3400-\u9fff]/.test(phrase))) return 'ja'
  const englishDefaults = new Set(defaultPhrases('en'))
  if (phrases.some((phrase) => englishDefaults.has(phrase))) return 'en'
  return fallback
}

/** 旧版の共通定型文を、内容に合う言語側へ一度だけ移す。 */
function migrateLegacyPhrases(requestedLang: Lang): string[] | null {
  const legacy = readPhraseList(LEGACY_PHRASES_KEY)
  if (legacy === null) return null

  const targetLang = inferLegacyLanguage(legacy, requestedLang)
  const targetKey = phrasesKey(targetLang)
  const existing = readPhraseList(targetKey)
  if (existing === null) saveJSON(targetKey, legacy)
  removeStoredValue(LEGACY_PHRASES_KEY)

  if (targetLang !== requestedLang) return null
  return existing ?? legacy
}

export function loadPhrases(lang: Lang): string[] {
  const saved = readPhraseList(phrasesKey(lang))
  if (saved !== null) return saved
  return migrateLegacyPhrases(lang) ?? defaultPhrases(lang)
}

export function savePhrases(lang: Lang, phrases: string[]): void {
  saveJSON(phrasesKey(lang), phrases)
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
