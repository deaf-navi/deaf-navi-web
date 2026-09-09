import navigation from '../../../../config/site-navigation.json'
import { useSettings } from '../state/settings'
import '../../../../src/assets/site-shell.css'

export function SiteHeader() {
  const { settings, update } = useSettings()
  const en = settings.lang === 'en'
  const dark = settings.theme === 'dark' || settings.theme === 'green'
  return (
    <header className="dn-site-shell" role="banner">
      <div className="dn-shell-inner">
        <div className="dn-shell-top">
          <a className="dn-shell-brand" href="../" aria-label={en ? 'Deaf Navi home' : 'Deaf Navi ホーム'}>
            <span className="dn-shell-mark" aria-hidden="true"><img src="../favicon.svg" alt="" width="36" height="36" /></span>
            <span className="dn-shell-wordmark"><span className="dn-shell-name"><strong>Deaf Navi</strong><span className="dn-shell-edition">Web</span></span><small>{en ? 'News, places & everyday support' : 'ニュースと、つながりと、暮らし。'}</small></span>
          </a>
          <div className="display-controls">
            <button className="display-controls__btn" type="button" aria-pressed={dark} onClick={() => update({ theme: dark ? 'light' : 'dark' })}>
              <span className="display-controls__icon" aria-hidden="true">◐</span><span data-theme-label>{en ? (dark ? 'Light theme' : 'Dark theme') : (dark ? 'ライト表示' : 'ダーク表示')}</span>
            </button>
            <a className="dn-shell-settings" href="#/settings">{en ? 'Settings' : '設定'}</a>
          </div>
        </div>
        <nav className="site-nav" aria-label={en ? 'Deaf Navi pages' : 'サイト内ページ'}>
          {navigation.map(item => <a key={item.key} className={`site-nav__link${item.key === 'tool' ? ' is-current' : ''}`} href={`../${item.path}`} aria-current={item.key === 'tool' ? 'page' : undefined}><span>{en ? item.en : item.ja}</span></a>)}
        </nav>
      </div>
    </header>
  )
}
