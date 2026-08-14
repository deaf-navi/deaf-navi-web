import { useEffect, useRef } from 'react'
import { SettingsProvider, useSettings } from './state/settings'
import { useRoute, routeToHash } from './router'
import { Home } from './modules/home/Home'
import { SoundSentinel } from './modules/sound/SoundSentinel'
import { Captions } from './modules/captions/Captions'
import { Board } from './modules/board/Board'
import { SettingsScreen } from './modules/settings/SettingsScreen'
import {
  IconCaptions,
  IconHome,
  IconPen,
  IconSettings,
  IconSound,
} from './components/icons'
import type { Route } from './types'
import type { MsgKey } from './i18n'
import type { ComponentType } from 'react'

const NAV_ITEMS: Array<[Route, MsgKey, ComponentType<{ size?: number }>]> = [
  ['home', 'nav.home', IconHome],
  ['sound', 'nav.sound', IconSound],
  ['captions', 'nav.captions', IconCaptions],
  ['board', 'nav.board', IconPen],
  ['settings', 'nav.settings', IconSettings],
]

function BottomNav({ route }: { route: Route }) {
  const { t } = useSettings()
  return (
    <nav className="bottom-nav" aria-label={t('a11y.appNav')}>
      <ul>
        {NAV_ITEMS.map(([r, key, Icon]) => (
          <li key={r}>
            <a
              href={routeToHash(r)}
              aria-current={route === r ? 'page' : undefined}
              className="nav-item"
            >
              <Icon size={24} />
              <span>{t(key)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ProductHeader() {
  const { t } = useSettings()
  return (
    <header className="product-header">
      <div>
        <p className="product-header-kicker">{t('app.extension')}</p>
        <p className="product-header-name">{t('app.name')}</p>
      </div>
      <a className="product-header-back" href="../index.html">
        <IconHome size={18} />
        <span>{t('app.backToDeafNavi')}</span>
      </a>
    </header>
  )
}

function Shell() {
  const route = useRoute()
  const { t } = useSettings()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // ルート切替時: 先頭へスクロールし、フォーカスを本文へ移す（SPAのa11y定石）
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [route])

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('a11y.skipToContent')}
      </a>
      <ProductHeader />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="app-main">
        {route === 'home' && <Home />}
        {route === 'sound' && <SoundSentinel />}
        {route === 'captions' && <Captions />}
        {route === 'board' && <Board />}
        {route === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav route={route} />
    </>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  )
}
