import { ja, type MsgKey } from './ja'
import { en } from './en'
import type { Lang } from '../types'

const dicts: Record<Lang, Record<MsgKey, string>> = { ja, en }

export type { MsgKey }

/** 文字列中の {name} を params で置換する */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  )
}

export function translate(lang: Lang, key: MsgKey, params?: Record<string, string | number>): string {
  const s = dicts[lang][key] ?? ja[key] ?? key
  return interpolate(s, params)
}

export type Translator = (key: MsgKey, params?: Record<string, string | number>) => string

export function makeT(lang: Lang): Translator {
  return (key, params) => translate(lang, key, params)
}
