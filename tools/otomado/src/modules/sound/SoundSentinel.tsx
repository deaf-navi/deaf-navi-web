import { useSettings } from '../../state/settings'
import { ALL_CATEGORIES, type Sensitivity } from '../../types'
import { CategoryIcon } from '../../components/icons'
import { formatTime } from '../../lib/format'
import { useSoundWatch } from './useSoundWatch'
import { LevelMeter } from './LevelMeter'
import { AlertOverlay } from './AlertOverlay'
import type { MsgKey } from '../../i18n'

export function SoundSentinel() {
  const { settings, update, setCategoryEnabled, t } = useSettings()
  const watch = useSoundWatch()
  const { status, ai, events, activeAlert } = watch
  const running = status === 'running'
  const starting = status === 'starting'

  const catLabel = (c: string) => t(`cat.${c}` as MsgKey)

  const announceText =
    settings.srAnnounce && activeAlert
      ? `${t('sound.detected', { name: catLabel(activeAlert.category) })} ${formatTime(activeAlert.at, settings.lang)}`
      : ''

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('nav.sound')}</h1>
        <p>{t('sound.desc')}</p>
      </header>

      <section className="card sound-main">
        {running || starting ? (
          <button
            type="button"
            className="btn btn-stop btn-xl"
            onClick={watch.stop}
            disabled={starting}
          >
            {starting ? t('sound.starting') : t('sound.stop')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-xl" onClick={() => void watch.start()}>
            {t('sound.start')}
          </button>
        )}

        {status === 'mic-denied' && (
          <p className="error-note" role="alert">
            {t('sound.micDenied')}
          </p>
        )}
        {status === 'mic-unavailable' && (
          <p className="error-note" role="alert">
            {t('sound.micUnavailable')}
          </p>
        )}

        {running && (
          <div className="sound-status">
            <span className="live-dot" aria-hidden="true" />
            <span>{t('sound.listening')}</span>
            <span className="sound-ai-status">
              {ai === 'ready' && t('sound.aiReady')}
              {ai === 'loading' && t('sound.aiLoading')}
              {ai === 'unavailable' && t('sound.aiUnavailable')}
            </span>
          </div>
        )}

        <LevelMeter levelRef={watch.levelRef} active={running} />
        {running && <p className="hint">{t('sound.wakeLockNote')}</p>}
      </section>

      <section className="card" aria-labelledby="sound-cats-heading">
        <h2 id="sound-cats-heading" className="card-heading">
          {t('sound.categories')}
        </h2>
        <div className="chip-grid">
          {ALL_CATEGORIES.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip cat-${id}`}
              aria-pressed={settings.enabled[id]}
              onClick={() => setCategoryEnabled(id, !settings.enabled[id])}
            >
              <CategoryIcon category={id} size={20} />
              <span>{catLabel(id)}</span>
            </button>
          ))}
        </div>

        <div className="sensitivity-row">
          <label htmlFor="sensitivity">{t('sound.sensitivity')}</label>
          <div className="sensitivity-slider">
            <span aria-hidden="true">{t('sound.sensitivityLow')}</span>
            <input
              id="sensitivity"
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.sensitivity}
              onChange={(e) => update({ sensitivity: Number(e.target.value) as Sensitivity })}
              aria-valuetext={`${settings.sensitivity} / 5`}
            />
            <span aria-hidden="true">{t('sound.sensitivityHigh')}</span>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="sound-history-heading">
        <div className="card-heading-row">
          <h2 id="sound-history-heading" className="card-heading">
            {t('sound.history')}
          </h2>
          <div className="card-heading-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={watch.testAlert}>
              {t('sound.testAlert')}
            </button>
            {events.length > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={watch.clearHistory}>
                {t('sound.historyClear')}
              </button>
            )}
          </div>
        </div>
        {events.length === 0 ? (
          <p className="empty-note">{t('sound.historyEmpty')}</p>
        ) : (
          <ol className="event-list">
            {events.map((ev) => (
              <li key={ev.id} className={`event-item cat-${ev.category}`}>
                <span className="event-icon" aria-hidden="true">
                  <CategoryIcon category={ev.category} size={22} />
                </span>
                <span className="event-name">{catLabel(ev.category)}</span>
                <time className="event-time" dateTime={new Date(ev.at).toISOString()}>
                  {formatTime(ev.at, settings.lang)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="privacy-note">{t('sound.privacy')}</p>

      {activeAlert && <AlertOverlay event={activeAlert} onDismiss={watch.dismissAlert} />}
      <div aria-live="assertive" className="visually-hidden">
        {announceText}
      </div>
      {/* 稼働状態の通知は常設のライブリージョンで行う（内容ごと新規挿入だとSRが読まないため） */}
      <div aria-live="polite" className="visually-hidden">
        {running ? t('sound.listening') : ''}
      </div>
    </div>
  )
}
