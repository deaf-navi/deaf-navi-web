import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '../../state/settings'
import { Captions } from './Captions'
import type { SpeechRecognitionEventLike } from '../../lib/speech/recognition'

class MockRecognition {
  static instances: MockRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((e: SpeechRecognitionEventLike) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  started = false

  constructor() {
    MockRecognition.instances.push(this)
  }

  start() {
    this.started = true
  }

  stop() {
    this.started = false
    this.onend?.()
  }

  abort() {}
}

function lastRec(): MockRecognition {
  return MockRecognition.instances[MockRecognition.instances.length - 1]
}

function fireResult(text: string, isFinal: boolean) {
  act(() => {
    lastRec().onresult?.({
      resultIndex: 0,
      results: [{ isFinal, 0: { transcript: text }, length: 1 }],
    })
  })
}

function renderCaptions() {
  return render(
    <SettingsProvider>
      <Captions />
    </SettingsProvider>,
  )
}

type W = { webkitSpeechRecognition?: unknown }

beforeEach(() => {
  MockRecognition.instances = []
  ;(window as unknown as W).webkitSpeechRecognition = MockRecognition
})

afterEach(() => {
  delete (window as unknown as W).webkitSpeechRecognition
})

describe('Captions', () => {
  it('shows the unsupported message when SpeechRecognition is missing', () => {
    delete (window as unknown as W).webkitSpeechRecognition
    renderCaptions()
    expect(screen.getByText(/このブラウザは音声認識に対応していません/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ひつだんを開く' })).toBeInTheDocument()
  })

  it('starts recognition with continuous interim results in Japanese', async () => {
    const user = userEvent.setup()
    renderCaptions()
    await user.click(screen.getByRole('button', { name: '字幕をはじめる' }))
    const rec = lastRec()
    expect(rec.started).toBe(true)
    expect(rec.continuous).toBe(true)
    expect(rec.interimResults).toBe(true)
    expect(rec.lang).toBe('ja-JP')
    expect(screen.getByRole('button', { name: '字幕をとめる' })).toBeInTheDocument()
  })

  it('renders interim then final captions', async () => {
    const user = userEvent.setup()
    renderCaptions()
    await user.click(screen.getByRole('button', { name: '字幕をはじめる' }))

    fireResult('こんに', false)
    expect(screen.getByText('こんに')).toHaveClass('cap-interim')

    fireResult('こんにちは', true)
    expect(screen.getByText('こんにちは')).not.toHaveClass('cap-interim')
    expect(screen.queryByText('こんに')).not.toBeInTheDocument()
  })

  it('clears captions', async () => {
    const user = userEvent.setup()
    renderCaptions()
    await user.click(screen.getByRole('button', { name: '字幕をはじめる' }))
    fireResult('テストです', true)
    await user.click(screen.getByRole('button', { name: '字幕を消す' }))
    expect(screen.queryByText('テストです')).not.toBeInTheDocument()
    expect(screen.getByText('ここに字幕が表示されます')).toBeInTheDocument()
  })

  it('changes the font size setting via the stepper', async () => {
    const user = userEvent.setup()
    renderCaptions()
    const bigger = screen.getByRole('button', { name: '文字を大きく' })
    await user.click(bigger)
    const saved = JSON.parse(localStorage.getItem('otomado:settings:v1')!)
    expect(saved.captionScale).toBe(4)
  })

  it('shows an error message on network failure', async () => {
    const user = userEvent.setup()
    renderCaptions()
    await user.click(screen.getByRole('button', { name: '字幕をはじめる' }))
    act(() => {
      lastRec().onerror?.({ error: 'network' })
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/音声認識サービスに接続できませんでした/)
  })
})
