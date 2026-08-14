import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom の navigator.language は en-US のため、テストは日本語UIを既定にする
beforeEach(() => {
  localStorage.setItem('otomado:settings:v1', JSON.stringify({ lang: 'ja' }))
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.location.hash = ''
})

// ---- jsdom に無いブラウザAPIの最小実装 ----

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}

window.scrollTo = (() => undefined) as typeof window.scrollTo

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback): number =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number
  window.cancelAnimationFrame = (id: number) => clearTimeout(id)
}
