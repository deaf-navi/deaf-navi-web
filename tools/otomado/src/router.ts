import { useSyncExternalStore } from 'react'
import type { Route } from './types'

const ROUTES: Route[] = ['home', 'sound', 'captions', 'board', 'settings']

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase()
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home'
}

export function routeToHash(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route)
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseHash(window.location.hash))
}
