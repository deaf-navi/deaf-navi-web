import { useSettings } from '../../state/settings'
import { routeToHash } from '../../router'
import { IconCaptions, IconPen, IconSound } from '../../components/icons'
import type { Route } from '../../types'
import type { ReactNode } from 'react'

function ToolCard({
  route,
  icon,
  title,
  desc,
  tone,
}: {
  route: Route
  icon: ReactNode
  title: string
  desc: string
  tone: 'sound' | 'captions' | 'board'
}) {
  return (
    <a className="tool-card" data-tone={tone} href={routeToHash(route)}>
      <span className="tool-card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tool-card-body">
        <span className="tool-card-title">{title}</span>
        <span className="tool-card-desc">{desc}</span>
      </span>
    </a>
  )
}

export function Home() {
  const { t } = useSettings()
  return (
    <div className="page">
      <header className="hero">
        <span className="hero-mark" aria-hidden="true">
          <IconSound size={36} />
        </span>
        <h1 className="hero-title">{t('app.name')}</h1>
        <p className="hero-tagline">{t('app.tagline')}</p>
        <p className="hero-lead">{t('home.lead')}</p>
      </header>

      <nav className="tool-list" aria-label={t('nav.home')}>
        <ToolCard
          route="sound"
          tone="sound"
          icon={<IconSound size={30} />}
          title={t('nav.sound')}
          desc={t('home.sound.desc')}
        />
        <ToolCard
          route="captions"
          tone="captions"
          icon={<IconCaptions size={30} />}
          title={t('nav.captions')}
          desc={t('home.captions.desc')}
        />
        <ToolCard
          route="board"
          tone="board"
          icon={<IconPen size={30} />}
          title={t('nav.board')}
          desc={t('home.board.desc')}
        />
      </nav>

      <section className="card home-privacy" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="card-heading">
          {t('home.privacyTitle')}
        </h2>
        <p>{t('home.privacy.sound')}</p>
        <p>{t('home.privacy.captions')}</p>
      </section>

      <p className="home-install">{t('home.install')}</p>
    </div>
  )
}
