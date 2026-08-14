import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('renders the home screen with the three tools', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'おとまど' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'アプリ内ナビゲーション' })
    expect(nav).toBeInTheDocument()
  })

  it('renders the complete app shell in English and updates page metadata', () => {
    localStorage.setItem('otomado:settings:v1', JSON.stringify({ lang: 'en' }))
    render(<App />)

    expect(screen.getByRole('heading', { name: 'OtoMado' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'App navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Deaf Navi Web' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('OtoMado — A window to see sound.')
  })

  it('switches and persists the app language from the home screen', async () => {
    const user = userEvent.setup()
    render(<App />)

    const languageGroup = screen.getByRole('group', { name: '言語 / Language' })
    await user.click(within(languageGroup).getByRole('radio', { name: 'EN English' }))

    expect(screen.getByRole('heading', { name: 'OtoMado' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(JSON.parse(localStorage.getItem('otomado:settings:v1')!)).toMatchObject({ lang: 'en' })
  })

  it('has a skip link as the first focusable element', () => {
    render(<App />)
    expect(screen.getByText('本文へスキップ')).toHaveAttribute('href', '#main-content')
  })

  it('identifies itself as a Deaf Navi Web extension and links back', () => {
    render(<App />)
    expect(screen.getByText('Deaf Navi Web の拡張ツール')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deaf Navi Web へ戻る' })).toHaveAttribute(
      'href',
      '../index.html',
    )
  })

  it.each(['aurora', 'dark', 'light', 'green'])('applies the %s theme', (theme) => {
    localStorage.setItem('otomado:settings:v1', JSON.stringify({ lang: 'ja', theme }))
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe(theme)
  })

  it('navigates via hash changes and marks the current page', async () => {
    render(<App />)
    await act(async () => {
      window.location.hash = '#/board'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('heading', { name: 'ひつだん' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '言語 / Language' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'アプリ内ナビゲーション' })
    const current = nav.querySelector('[aria-current="page"]')
    expect(current).toHaveTextContent('ひつだん')
  })

  it('falls back to home for unknown hashes', async () => {
    render(<App />)
    await act(async () => {
      window.location.hash = '#/unknown'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(screen.getByRole('heading', { name: 'おとまど' })).toBeInTheDocument()
  })
})
