import { useEffect, useState } from 'react'
import { useSettings } from '../state/settings'
import './RelatedStories.css'

type Story = { title: string; url: string }
export function RelatedStories() {
  const [items, setItems] = useState<Story[]>([])
  const { settings } = useSettings()
  const en = settings.lang === 'en'
  useEffect(() => {
    const controller = new AbortController()
    fetch('/stories/feed.json?page=%2Fotomado%2F', { signal: controller.signal, credentials: 'omit' })
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(data => {
        if (!Array.isArray(data.articles)) return
        setItems(data.articles.filter((s: Story) => typeof s.title === 'string' && /^\/stories\/[a-z0-9-]+\/$/.test(s.url)).slice(0, 3))
      }).catch(() => {})
    return () => controller.abort()
  }, [])
  const marker = new URLSearchParams(location.search).get('dn_client') === 'codex' ? '?dn_client=codex' : ''
  return <footer className="reading-links">
    {items.length > 0 && <section aria-label={en ? 'Related stories' : '関連する読みもの'}>
      <h2>{en ? 'Related stories' : '関連する読みもの'}</h2>
      <ul>{items.map(item => <li key={item.url}><a href={item.url + marker}>{item.title}</a></li>)}</ul>
    </section>}
    <p><a href={'/stories/' + marker}>{en ? 'Deaf Navi Stories' : 'Deaf Naviの読みもの'}</a></p>
  </footer>
}
