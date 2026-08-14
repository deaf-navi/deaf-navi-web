import type { ReactNode } from 'react'
import type { CategoryId } from '../types'

interface IconProps {
  size?: number
  className?: string
}

function Svg({ children, size = 24, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  )
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-5h4v5" />
    </Svg>
  )
}

export function IconSound(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8.5 8.5a5 5 0 0 1 0 7" />
      <path d="M12 5.5a9.5 9.5 0 0 1 0 13" />
      <path d="M15.5 2.5a14 14 0 0 1 0 19" />
    </Svg>
  )
}

export function IconCaptions(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M6.5 12h6" />
      <path d="M6.5 15.5h11" />
    </Svg>
  )
}

export function IconPen(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  )
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
      <circle cx="9" cy="7" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="2.4" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconBell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Svg>
  )
}

export function IconAlertTriangle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconBaby(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M9 12h.6" />
      <path d="M14.4 12h.6" />
      <ellipse cx="12" cy="15.8" rx="1.8" ry="2.2" />
      <path d="M12 5.5c0-1.6 1-2.8 2.2-3" />
    </Svg>
  )
}

export function IconPhone(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </Svg>
  )
}

export function IconZap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2 3 14h8l-1 8 11-13h-8l0-7Z" />
    </Svg>
  )
}

export function IconDoor(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="7" y="3" width="12" height="18" rx="1.5" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M3.5 9a4.5 4.5 0 0 1 0 6" />
    </Svg>
  )
}

export function IconPaw(p: IconProps) {
  return (
    <Svg {...p}>
      <ellipse cx="12" cy="16" rx="3.6" ry="3" />
      <circle cx="6.8" cy="10.5" r="1.7" />
      <circle cx="12" cy="8.3" r="1.7" />
      <circle cx="17.2" cy="10.5" r="1.7" />
    </Svg>
  )
}

export function IconMegaphone(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m3 11 15-6v14L3 13v-2Z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      <path d="M21.5 9.5v3" />
    </Svg>
  )
}

export function IconCar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 11 7 6.5a1.5 1.5 0 0 1 1.4-1h7.2a1.5 1.5 0 0 1 1.4 1L18.5 11" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <path d="M6 17v2M18 17v2" />
      <path d="M6.5 14h.6M16.9 14h.6" />
    </Svg>
  )
}

export function IconVolume(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M11 5 6.5 8.5H3v7h3.5L11 19V5Z" />
      <path d="M15 9a5 5 0 0 1 0 6" />
      <path d="M18 6a9.5 9.5 0 0 1 0 12" />
    </Svg>
  )
}

export function IconFlip(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 12a9 9 0 1 0 3.4-7" />
      <path d="M3 4v5h5" />
    </Svg>
  )
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  )
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  )
}

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
}

export function IconArrowDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14" />
      <path d="m5 12 7 7 7-7" />
    </Svg>
  )
}

/** カテゴリ → アイコンの対応 */
export function CategoryIcon({ category, size, className }: IconProps & { category: CategoryId }) {
  const p = { size, className }
  switch (category) {
    case 'chime':
      return <IconBell {...p} />
    case 'siren':
      return <IconAlertTriangle {...p} />
    case 'baby':
      return <IconBaby {...p} />
    case 'phone':
      return <IconPhone {...p} />
    case 'beep':
      return <IconZap {...p} />
    case 'knock':
      return <IconDoor {...p} />
    case 'dog':
      return <IconPaw {...p} />
    case 'shout':
      return <IconMegaphone {...p} />
    case 'horn':
      return <IconCar {...p} />
    case 'loud':
      return <IconVolume {...p} />
  }
}
