import { ref, watchEffect } from 'vue'

export type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'aa-demo-theme'
const isChoice = (v: unknown): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark'

function initialChoice(): ThemeChoice {
  const fromUrl = new URLSearchParams(window.location.search).get('theme')
  if (isChoice(fromUrl)) return fromUrl
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isChoice(stored)) return stored
  } catch {
    // storage unavailable
  }
  return 'system'
}

const query =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(query?.matches ?? false)
query?.addEventListener('change', (e) => (systemDark.value = e.matches))

/** What the user picked in the switcher (`system` follows the OS). */
export const themeChoice = ref<ThemeChoice>(initialChoice())

/** The palette actually shown. */
export const resolvedTheme = ref<'light' | 'dark'>('light')

export function setTheme(choice: ThemeChoice) {
  themeChoice.value = choice
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // storage unavailable
  }
  // an explicit ?theme= in the address bar would win again on reload, so keep it in sync
  const url = new URL(window.location.href)
  if (url.searchParams.has('theme')) {
    url.searchParams.set('theme', choice)
    window.history.replaceState(null, '', url)
  }
}

// The page is styled through `data-theme` on <html> (see the Tailwind `dark` variant in main.css).
// The component gets the same value through its `theme` prop.
watchEffect(() => {
  resolvedTheme.value =
    themeChoice.value === 'system' ? (systemDark.value ? 'dark' : 'light') : themeChoice.value
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.style.colorScheme = resolvedTheme.value
})
