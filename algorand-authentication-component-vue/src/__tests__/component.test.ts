import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { stubAlgodParams } from './helpers'

const connect = vi.fn()
const signTransactions = vi.fn()
const makeWallet = (id: string, name: string, connectFn = vi.fn()) => ({
  id,
  walletKey: id,
  metadata: { name, icon: 'data:image/png;base64,AA==' },
  accounts: [],
  activeAccount: null,
  isConnected: false,
  isActive: false,
  connect: connectFn,
  disconnect: vi.fn(),
  setActive: vi.fn()
})
const wallets = ref([
  makeWallet('biatec', 'Biatec Wallet', connect),
  makeWallet('pera', 'Pera Wallet')
])

vi.mock('@txnlab/use-wallet-vue', () => ({
  useWallet: () => ({
    activeWallet: computed(() => null),
    activeAddress: computed(() => null),
    availableWallets: computed(() => wallets.value),
    algodClient: computed(() => new algosdk.Algodv2('', 'http://algod.test', 443)),
    signTransactions,
    transactionSigner: vi.fn()
  })
}))

import AlgorandAuthentication from '../components/AlgorandAuthentication.vue'
import { deriveArc76Account } from '../scripts/arc76'
import { useAVMAuthentication } from '../scripts/useAVMAuthentication'
import { authStore, resetAuthStore } from '../store/authStore'

const PASSWORD = 'a-very-long-password-123'

const mountComponent = (props: Record<string, unknown> = {}) =>
  mount(AlgorandAuthentication, {
    props: { arc14Realm: 'Auth#ARC14', algodHost: 'http://algod.test', algodPort: 443, ...props },
    slots: { default: '<p data-testid="content">Secret</p>' }
  })

describe('<AlgorandAuthentication>', () => {
  beforeEach(() => {
    resetAuthStore()
    connect.mockReset()
    signTransactions.mockReset()
    stubAlgodParams()
  })

  it('renders the slot when authentication is not required', () => {
    const w = mountComponent()
    expect(w.find('[data-testid="content"]').exists()).toBe(true)
    expect(w.find('[data-testid="aa-screen"]').exists()).toBe(false)
  })

  it('shows the sign-in screen with email form and wallet list', () => {
    const w = mountComponent({ authorizedOnlyAccess: true })
    expect(w.find('[data-testid="content"]').exists()).toBe(false)
    expect(w.get('[data-testid="aa-title"]').text()).toBe('Sign in')
    expect(w.find('[data-testid="aa-wallet-biatec"]').exists()).toBe(true)
    expect(w.find('[data-testid="aa-wallet-pera"]').exists()).toBe(true)
  })

  it('filters wallets by the `wallets` prop', () => {
    const w = mountComponent({ authorizedOnlyAccess: true, wallets: ['biatec'] })
    expect(w.find('[data-testid="aa-wallet-biatec"]').exists()).toBe(true)
    expect(w.find('[data-testid="aa-wallet-pera"]').exists()).toBe(false)
  })

  it('validates the form and toggles registration', async () => {
    const w = mountComponent({ authorizedOnlyAccess: true })
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await w.get('#e').setValue('nope')
    await w.get('#p').setValue('short')
    expect(w.get('[data-testid="aa-form-error"]').text()).toBe('Email is not valid')
    await w.get('#e').setValue('user@example.com')
    expect(w.get('[data-testid="aa-form-error"]').text()).toContain('at least 16')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Register')!
      .trigger('click')
    expect(w.get('[data-testid="aa-title"]').text()).toBe('Registration')
    expect(w.find('#p2').exists()).toBe(true)
  })

  it('signs in with an ARC-76 account and produces an ARC-14 header', async () => {
    const w = mountComponent({ authorizedOnlyAccess: true })
    await w.get('#e').setValue('user@example.com')
    await w.get('#p').setValue(PASSWORD)
    await w.get('form').trigger('submit')
    await vi.waitFor(() => expect(authStore.isAuthenticated).toBe(true), { timeout: 20_000 })
    expect(authStore.wallet).toBe('arc76')
    expect(authStore.arc14Header.startsWith('SigTx ')).toBe(true)
    expect(authStore.password).toBe('')
    await nextTick()
    expect(w.find('[data-testid="content"]').exists()).toBe(true)
    expect(w.emitted('authenticated')).toHaveLength(1)
  }, 30_000)

  it('signs in with a wallet through use-wallet', async () => {
    const account = algosdk.generateAccount()
    connect.mockResolvedValue([{ name: 'a', address: account.addr.toString() }])
    signTransactions.mockImplementation(async ([txn]: algosdk.Transaction[]) => [
      txn.signTxn(account.sk)
    ])
    const w = mountComponent({ authorizedOnlyAccess: true })
    await w.get('[data-testid="aa-wallet-biatec"]').trigger('click')
    await flushPromises()
    expect(connect).toHaveBeenCalledOnce()
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.wallet).toBe('biatec')
    expect(authStore.account).toBe(account.addr.toString())
    expect(authStore.arc14Header.startsWith('SigTx ')).toBe(true)
    expect(authStore.inWalletSignature).toBe(false)
  })

  it('reports wallet errors', async () => {
    connect.mockRejectedValue(new Error('User rejected'))
    const w = mountComponent({ authorizedOnlyAccess: true })
    await w.get('[data-testid="aa-wallet-biatec"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="aa-wallet-error"]').text()).toBe('User rejected')
    expect(w.emitted('onNotification')?.[0]).toEqual([
      { severity: 'error', message: 'User rejected' }
    ])
    expect(authStore.isAuthenticated).toBe(false)
  })
})

describe('ARC-76 transaction signing', () => {
  beforeEach(() => {
    resetAuthStore()
    stubAlgodParams()
  })

  const makeTxn = (addr: string) =>
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: addr,
      receiver: addr,
      amount: 0,
      suggestedParams: {
        fee: 1000,
        minFee: 1000,
        flatFee: true,
        firstValid: 1,
        lastValid: 1000,
        genesisID: 'testnet-v1.0',
        genesisHash: new Uint8Array(32)
      }
    })

  it('asks for the password, rejects a wrong one and signs with the right one', async () => {
    const w = mountComponent()
    const account = await deriveArc76Account('user@example.com', PASSWORD)
    authStore.wallet = 'arc76'
    authStore.isAuthenticated = true
    authStore.account = account.addr.toString()
    authStore.arc76email = 'user@example.com'

    const pending = useAVMAuthentication().sign([makeTxn(authStore.account)], [0])
    await nextTick()
    expect(w.find('[data-testid="aa-sign-dialog"]').exists()).toBe(true)

    await w.get('#aa-sign-password').setValue('a-wrong-password-12345')
    await w.get('[data-testid="aa-sign-dialog"] form').trigger('submit')
    await vi.waitFor(() => expect(w.find('[data-testid="aa-sign-error"]').exists()).toBe(true), {
      timeout: 20_000
    })
    expect(w.get('[data-testid="aa-sign-error"]').text()).toBe('Password is invalid')

    await w.get('#aa-sign-password').setValue(PASSWORD)
    await w.get('[data-testid="aa-sign-dialog"] form').trigger('submit')
    const signed = await pending
    expect(signed).toHaveLength(1)
    expect(algosdk.decodeSignedTransaction(signed[0]).sig).toBeDefined()
    await nextTick()
    expect(w.find('[data-testid="aa-sign-dialog"]').exists()).toBe(false)
  }, 60_000)

  it('rejects the sign() promise when the dialog is cancelled', async () => {
    const w = mountComponent()
    authStore.wallet = 'arc76'
    authStore.account = algosdk.generateAccount().addr.toString()
    const pending = useAVMAuthentication().sign([makeTxn(authStore.account)], [0])
    await nextTick()
    await w
      .findAll('[data-testid="aa-sign-dialog"] button')
      .find((b) => b.text() === 'Cancel')!
      .trigger('click')
    await expect(pending).rejects.toThrow('Signing cancelled by user')
    expect(authStore.inArc76Signature).toBe(false)
  })
})
