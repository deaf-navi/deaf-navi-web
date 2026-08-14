import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useSettings } from '../../state/settings'
import type { LevelSample } from './useSoundWatch'

/**
 * リアルタイム音量メーター。
 * 視覚更新は rAF で直接 DOM を操作（60fps）、aria 値は 2Hz に間引いて更新する。
 */
export function LevelMeter({
  levelRef,
  active,
}: {
  levelRef: RefObject<LevelSample>
  active: boolean
}) {
  const { t } = useSettings()
  const fillRef = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (!active) {
      if (fillRef.current) fillRef.current.style.clipPath = 'inset(0 100% 0 0)'
      setPct(0)
      return
    }
    let raf = 0
    let lastAria = 0
    const tick = (ts: number) => {
      const { rms } = levelRef.current
      // 知覚に合わせた平方根スケーリング
      const v = Math.min(1, Math.sqrt(rms) * 1.6)
      // clip-path で「トラック幅基準のグラデーション」を露出させる
      // （transform: scaleX だとグラデーション自体が潰れて常に赤端が見えてしまう）
      if (fillRef.current)
        fillRef.current.style.clipPath = `inset(0 ${(100 - v * 100).toFixed(1)}% 0 0)`
      if (ts - lastAria > 500) {
        setPct(Math.round(v * 100))
        lastAria = ts
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, levelRef])

  return (
    <div className="meter-wrap">
      <span className="meter-label" id="level-meter-label">
        {t('sound.level')}
      </span>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-labelledby="level-meter-label"
        className="meter"
      >
        <div ref={fillRef} className="meter-fill" />
      </div>
    </div>
  )
}
