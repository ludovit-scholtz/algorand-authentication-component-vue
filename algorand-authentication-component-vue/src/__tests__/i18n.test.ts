import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { mount } from '@vue/test-utils'
import { SUPPORTED_LOCALES, format, messages, resolveLocale } from '../i18n/messages'

vi.mock('@txnlab/use-wallet-vue', () => ({
  useWallet: () => ({
    activeWallet: computed(() => null),
    activeAddress: computed(() => null),
    availableWallets: computed(() => []),
    algodClient: computed(() => ({})),
    signTransactions: vi.fn(),
    transactionSigner: vi.fn()
  })
}))
import AlgorandAuthentication from '../components/AlgorandAuthentication.vue'

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()

describe('i18n catalog', () => {
  it('ships the union of Biatec Wallet and Biatec DEX languages', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      ['af', 'cs', 'de', 'en', 'es', 'hu', 'it', 'ko', 'nl', 'pl', 'ru', 'sk', 'tr', 'zh'].sort()
    )
  })

  it.each(SUPPORTED_LOCALES)('%s has every key and the same placeholders as English', (locale) => {
    expect(Object.keys(messages[locale])).toEqual(Object.keys(messages.en))
    for (const [key, value] of Object.entries(messages[locale])) {
      expect(value.trim(), key).not.toBe('')
      expect(placeholders(value), key).toBe(placeholders(messages.en[key as 'signIn']))
    }
  })

  it('resolves tags, lists and falls back to English', () => {
    expect(resolveLocale('zh-Hant-TW')).toBe('zh')
    expect(resolveLocale(['fr', 'pl-PL'])).toBe('pl')
    expect(resolveLocale(['fr', 'xx', 'en-GB'])).toBe('en')
  })

  it('formats placeholders and leaves unknown ones', () => {
    expect(format('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}')
  })
})

describe('<AlgorandAuthentication> localization', () => {
  const mountWith = (props: Record<string, unknown>) =>
    mount(AlgorandAuthentication, {
      props: { arc14Realm: 'r', authorizedOnlyAccess: true, ...props }
    })

  it.each(SUPPORTED_LOCALES)('renders %s', (locale) => {
    const w = mountWith({ locale })
    expect(w.get('[data-testid="aa-title"]').text()).toBe(messages[locale].signIn)
    expect(w.get('[data-testid="aa-screen"]').attributes('lang')).toBe(locale)
    expect(w.text()).toContain(messages[locale].orConnectWith)
    expect(w.text()).toContain(messages[locale].noWallets)
  })

  it('lets messages override single strings', () => {
    const w = mountWith({ locale: 'de', messages: { signIn: 'Willkommen' } })
    expect(w.get('[data-testid="aa-title"]').text()).toBe('Willkommen')
    expect(w.text()).toContain(messages.de.orConnectWith)
  })
})
