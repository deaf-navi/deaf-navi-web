import { useSettings } from '../../state/settings'
import { clearAllAppData } from '../../lib/storage'
import { vibrate } from '../../lib/vibrate'
import { APP_VERSION } from '../../version'
import type { ThemeSetting } from '../../types'

function ToggleRow({
  id,
  label,
  note,
  checked,
  onChange,
}: {
  id: string
  label: string
  note?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <span id={`${id}-label`} className="setting-label">
          {label}
        </span>
        {note && <span className="setting-note">{note}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
    </div>
  )
}

export function SettingsScreen() {
  const { settings, update, t } = useSettings()

  const themeOptions: Array<{ value: ThemeSetting; label: string }> = [
    { value: 'aurora', label: t('settings.theme.aurora') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'green', label: t('settings.theme.green') },
  ]
  const alertOptions: Array<{ value: number; label: string }> = [
    { value: 0, label: t('settings.alertDuration.manual') },
    { value: 8, label: t('settings.alertDuration.s8') },
    { value: 30, label: t('settings.alertDuration.s30') },
  ]

  const reset = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      clearAllAppData()
      window.location.reload()
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('nav.settings')}</h1>
      </header>

      <section className="card">
        <fieldset className="setting-fieldset">
          <legend className="card-heading">{t('settings.theme')}</legend>
          <div className="radio-row">
            {themeOptions.map((opt) => (
              <label
                key={opt.value}
                className={settings.theme === opt.value ? 'radio-option selected' : 'radio-option'}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={settings.theme === opt.value}
                  onChange={() => update({ theme: opt.value })}
                />
                <span className="theme-swatch" data-theme-preview={opt.value} aria-hidden="true" />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

      </section>

      <section className="card">
        <ToggleRow
          id="vibration"
          label={t('settings.vibration')}
          note={t('settings.vibrationNote')}
          checked={settings.vibration}
          onChange={(v) => update({ vibration: v })}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => vibrate([200])}>
          {t('settings.vibrationTest')}
        </button>

        <ToggleRow
          id="sr-announce"
          label={t('settings.srAnnounce')}
          note={t('settings.srAnnounceNote')}
          checked={settings.srAnnounce}
          onChange={(v) => update({ srAnnounce: v })}
        />
      </section>

      <section className="card">
        <fieldset className="setting-fieldset">
          <legend className="card-heading">{t('settings.alertDuration')}</legend>
          <div className="radio-row">
            {alertOptions.map((opt) => (
              <label
                key={opt.value}
                className={
                  settings.alertSeconds === opt.value ? 'radio-option selected' : 'radio-option'
                }
              >
                <input
                  type="radio"
                  name="alert-duration"
                  value={opt.value}
                  checked={settings.alertSeconds === opt.value}
                  onChange={() => update({ alertSeconds: opt.value })}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="setting-note">{t('settings.alertDurationNote')}</p>
        </fieldset>
      </section>

      <section className="card" aria-labelledby="about-heading">
        <h2 id="about-heading" className="card-heading">
          {t('settings.about')}
        </h2>
        <p>{t('settings.aboutText')}</p>
        <p className="setting-note">
          {t('settings.version')}: {APP_VERSION}
        </p>
        <h3 className="card-subheading">{t('settings.licenses')}</h3>
        <p className="setting-note">{t('settings.licensesText')}</p>
      </section>

      <section className="card">
        <button type="button" className="btn btn-danger" onClick={reset}>
          {t('settings.reset')}
        </button>
      </section>
    </div>
  )
}
