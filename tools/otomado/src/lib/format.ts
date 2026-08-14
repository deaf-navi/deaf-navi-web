import type { Lang } from '../types'

export function formatTime(at: number, lang: Lang): string {
  return new Date(at).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    // fallthrough
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
