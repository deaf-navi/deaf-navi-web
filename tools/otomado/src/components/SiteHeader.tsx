import { useEffect, useState } from 'react'
import navigation from '../../../../config/site-navigation.json'
import { useSettings } from '../state/settings'
import '../../../../src/assets/site-shell.css'

export function SiteHeader() {
  const { settings, update } = useSettings()
  const en = settings.lang === 'en'
  const dark = settings.theme === 'dark' || settings.theme === 'green'
  const [fontStep, setFontStep] = useState(() => {
    try {
      const saved = localStorage.getItem('dn-font')
      return saved === 'large' || saved === 'xlarge' ? saved : 'standard'
    } catch { return 'standard' }
  })
  useEffect(() => {
    if (fontStep === 'standard') delete document.documentElement.dataset.font
    else document.documentElement.dataset.font = fontStep
  }, [fontStep])
  const changeFont = () => {
    const next = fontStep === 'standard' ? 'large' : fontStep === 'large' ? 'xlarge' : 'standard'
    setFontStep(next)
    try {
      if (next === 'standard') localStorage.removeItem('dn-font')
      else localStorage.setItem('dn-font', next)
    } catch { /* The control still works when storage is unavailable. */ }
  }
  const fontLabel = en
    ? (fontStep === 'standard' ? 'Larger text' : fontStep === 'large' ? 'Largest text' : 'Standard text')
    : (fontStep === 'standard' ? '文字を大きく' : fontStep === 'large' ? '文字をさらに大きく' : '文字を標準に戻す')
  return (
    <header className="dn-site-shell" role="banner">
      <div className="dn-shell-inner">
        <div className="dn-shell-top">
          <a className="dn-shell-brand" href="../" aria-label={en ? 'Deaf Navi home' : 'Deaf Navi ホーム'}>
            <span className="dn-shell-mark" aria-hidden="true"><img src="../icons/icon-192.png?v=20260917c" alt="" width="44" height="44" /></span>
            <span className="dn-shell-wordmark"><span className="dn-shell-name"><strong>Deaf Navi</strong><span className="dn-shell-edition">Web</span></span><small>{en ? 'News, places & everyday support' : 'ニュースと、つながりと、暮らし。'}</small></span>
          </a>
          <div className="display-controls">
            <button id="theme-toggle" className="display-controls__btn" type="button" aria-pressed={dark} onClick={() => update({ theme: dark ? 'light' : 'dark' })}>
              <span className="display-controls__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{dark ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4"/></> : <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>}</svg></span><span data-theme-label>{en ? (dark ? 'Light theme' : 'Dark theme') : (dark ? 'ライト表示' : 'ダーク表示')}</span>
            </button>
            <button id="font-toggle" className="display-controls__btn" type="button" aria-pressed={fontStep !== 'standard'} onClick={changeFont}>
              <span className="display-controls__icon display-controls__icon--text" aria-hidden="true">あ</span><span data-font-label>{fontLabel}</span>
            </button>
          </div>
        </div>
        <nav className="site-nav" aria-label={en ? 'Deaf Navi pages' : 'サイト内ページ'}>
          {navigation.map(item => <a key={item.key} className={`site-nav__link${item.key === 'tool' ? ' is-current' : ''}`} href={`../${item.path}`} aria-current={item.key === 'tool' ? 'page' : undefined}><span>{en ? item.en : item.ja}</span></a>)}
        </nav>
      </div>
    </header>
  )
}
