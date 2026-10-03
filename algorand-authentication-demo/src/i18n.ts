import {
  formatMessage as format,
  resolveLocale,
  type AuthLocale
} from 'algorand-authentication-component-vue'
export { demoMessages, type DemoMessages } from './messages'

const STORAGE_KEY = 'aa-demo-lang'

/** Language from `?lang=xx`, then localStorage, then the browser. */
export function currentLocale(): AuthLocale {
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage unavailable
  }
  return resolveLocale(
    [new URLSearchParams(window.location.search).get('lang') ?? '', stored ?? ''].filter(Boolean)
  )
}

/** Remembers the language and reloads: the Biatec dialog reads its locale when the wallet manager is created. */
export function switchLocale(locale: AuthLocale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // storage unavailable
  }
  const url = new URL(window.location.href)
  url.searchParams.set('lang', locale)
  window.location.assign(url.toString())
}

export { format }
