import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

/**
 * コンテナに収まる最大フォントサイズを二分探索で求めて表示する。
 * ひつだんの「大きく表示」で、短文は巨大に・長文も必ず全文収まる。
 */
export function AutoFitText({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const fit = useCallback(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    let lo = 16
    let hi = 240
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      inner.style.fontSize = `${mid}px`
      const fits = inner.scrollHeight <= box.clientHeight && inner.scrollWidth <= box.clientWidth
      if (fits) lo = mid
      else hi = mid - 1
    }
    inner.style.fontSize = `${lo}px`
  }, [])

  useLayoutEffect(() => {
    fit()
  }, [text, fit])

  useEffect(() => {
    window.addEventListener('resize', fit)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && boxRef.current) {
      ro = new ResizeObserver(fit)
      ro.observe(boxRef.current)
    }
    return () => {
      window.removeEventListener('resize', fit)
      ro?.disconnect()
    }
  }, [fit])

  return (
    <div className="autofit-box" ref={boxRef}>
      <div className="autofit-text" ref={innerRef}>
        {text}
      </div>
    </div>
  )
}
