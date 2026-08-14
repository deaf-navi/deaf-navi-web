import { describe, expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '../../state/settings'
import { Board } from './Board'
import { phrasesKey } from './phrases'

function renderBoard() {
  return render(
    <SettingsProvider>
      <Board />
    </SettingsProvider>,
  )
}

describe('Board', () => {
  it('disables the show button until text is entered', async () => {
    const user = userEvent.setup()
    renderBoard()
    const show = screen.getByRole('button', { name: '大きく表示' })
    expect(show).toBeDisabled()
    await user.type(screen.getByLabelText('ひつだん'), 'こんにちは')
    expect(show).toBeEnabled()
  })

  it('shows text fullscreen and flips it', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.type(screen.getByLabelText('ひつだん'), 'トイレはどこですか')
    await user.click(screen.getByRole('button', { name: '大きく表示' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('トイレはどこですか')).toBeInTheDocument()

    const flip = within(dialog).getByRole('button', { name: /反転/ })
    expect(flip).toHaveAttribute('aria-pressed', 'false')
    await user.click(flip)
    expect(flip).toHaveAttribute('aria-pressed', 'true')
    expect(dialog.querySelector('.board-show-stage')).toHaveClass('flipped')
  })

  it('closes with Escape and returns to compose', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.type(screen.getByLabelText('ひつだん'), 'テスト')
    await user.click(screen.getByRole('button', { name: '大きく表示' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // テキストは残る（続きから編集できる）
    expect(screen.getByLabelText('ひつだん')).toHaveValue('テスト')
  })

  it('shows a quick phrase directly', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'ゆっくり、はっきり話してください' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('ゆっくり、はっきり話してください')).toBeInTheDocument()
  })

  it('shows English UI and English quick phrases when English is selected', () => {
    localStorage.setItem('otomado:settings:v1', JSON.stringify({ lang: 'en' }))
    renderBoard()

    expect(screen.getByRole('heading', { name: 'Writing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Please write it down.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ゆっくり、はっきり話してください' })).not.toBeInTheDocument()
  })

  it('shows with Ctrl+Enter', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.type(screen.getByLabelText('ひつだん'), '駅はどこですか')
    await act(async () => {
      await user.keyboard('{Control>}{Enter}{/Control}')
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('adds and deletes a phrase, persisting to localStorage', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.type(screen.getByLabelText('ひつだん'), '新しい定型文')
    await user.click(screen.getByRole('button', { name: 'いまの文を定型文に追加' }))
    expect(JSON.parse(localStorage.getItem(phrasesKey('ja'))!)).toContain('新しい定型文')

    await user.click(screen.getByRole('button', { name: '定型文を編集' }))
    await user.click(screen.getByRole('button', { name: '定型文「新しい定型文」を削除' }))
    expect(JSON.parse(localStorage.getItem(phrasesKey('ja'))!)).not.toContain('新しい定型文')
  })
})
