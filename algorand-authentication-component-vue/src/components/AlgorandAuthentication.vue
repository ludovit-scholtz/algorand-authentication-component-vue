<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import algosdk from 'algosdk'
import { useWallet, type Wallet } from '@txnlab/use-wallet-vue'

import '../styles/authentication.css'
import AaAlert from './AaAlert.vue'
import AaField from './AaField.vue'
import arc14, { arc14Header } from '../scripts/arc14'
import { ARC76_MIN_PASSWORD_LENGTH, deriveArc76Account, isValidEmail } from '../scripts/arc76'
import { authStore } from '../store/authStore'
import type { INotification } from '../types'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Wallet ids (use-wallet `wallet.id`) to offer. Empty / omitted = every available wallet. */
    wallets?: string[]
    /** Realm written to the ARC-14 note: `<realm>#ARC14`. */
    arc14Realm: string
    /** Custom algod. When omitted the active use-wallet network is used. */
    algodHost?: string
    algodToken?: string
    algodPort?: number | string
    /** Show the sign-in screen instead of the slot until the user is authenticated. */
    authorizedOnlyAccess?: boolean
    /** Optional background image URL for the sign-in screen. */
    coverImage?: string
  }>(),
  {
    wallets: () => [],
    algodHost: undefined,
    algodToken: undefined,
    algodPort: undefined,
    authorizedOnlyAccess: false,
    coverImage: undefined
  }
)

const emit = defineEmits<{
  onNotification: [notification: INotification]
  authenticated: [session: { account: string; wallet: string; arc14Header: string }]
}>()

const { activeWallet, activeAddress, availableWallets, algodClient, signTransactions } = useWallet()

// Passwords stay in component state - never in the shared (devtools-visible) store
const password = ref('')
const password2 = ref('')
const busy = ref<'' | 'arc76' | 'sign' | `wallet:${string}`>('')
const signError = ref('')
const walletError = ref('')

const visibleWallets = computed<Wallet[]>(() =>
  props.wallets.length
    ? availableWallets.value.filter((w) => props.wallets.includes(w.id))
    : availableWallets.value
)

/** A wallet session (e.g. restored after a page reload) that has not signed in yet. */
const pendingWallet = computed(() =>
  activeWallet.value?.isConnected && activeAddress.value ? activeWallet.value : null
)

const showAuthentication = computed(
  () => authStore.inAuthentication || (props.authorizedOnlyAccess && !authStore.isAuthenticated)
)

const screenStyle = computed(() =>
  props.coverImage ? { '--aa-cover': `url("${props.coverImage}")` } : undefined
)

const notify = (notification: INotification) => emit('onNotification', notification)
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

const getAlgod = () =>
  props.algodHost
    ? new algosdk.Algodv2(props.algodToken ?? '', props.algodHost, props.algodPort ?? '')
    : algodClient.value

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-6)}`

function formError(): string | undefined {
  authStore.emailIsValid = isValidEmail(authStore.arc76email)
  if (!authStore.emailIsValid) return 'Email is not valid'
  if (password.value.length < ARC76_MIN_PASSWORD_LENGTH)
    return `Password must be at least ${ARC76_MIN_PASSWORD_LENGTH} chars long`
  if (authStore.inRegistration) {
    if (password2.value && password.value !== password2.value) return 'Passwords do not match'
    if (password.value && !password2.value) return 'Please fill in the password confirmation field'
  }
  return undefined
}

const currentFormError = computed(() => formError())
const canSubmit = computed(
  () => !currentFormError.value && !(authStore.inRegistration && !password2.value) && !busy.value
)

function completeLogin(account: string, wallet: string, header: string) {
  authStore.count++
  authStore.account = account
  authStore.wallet = wallet
  authStore.arc14Header = header
  authStore.isAuthenticated = true
  password.value = ''
  password2.value = ''
  authStore.inRegistration = false
  authStore.inAuthentication = false
  emit('authenticated', { account, wallet, arc14Header: header })
}

async function authArc76Auth() {
  if (!canSubmit.value) return
  busy.value = 'arc76'
  try {
    const account = await deriveArc76Account(authStore.arc76email, password.value)
    const params = await getAlgod().getTransactionParams().do()
    const signed = arc14(props.arc14Realm, account.addr.toString(), params).signTxn(account.sk)
    completeLogin(account.addr.toString(), 'arc76', arc14Header(signed))
  } catch (e) {
    notify({ severity: 'error', message: errorMessage(e) })
  } finally {
    busy.value = ''
  }
}

async function authenticateWithWallet(walletId: string, address: string) {
  const params = await getAlgod().getTransactionParams().do()
  const txn = arc14(props.arc14Realm, address, params)
  authStore.inWalletSignature = true
  try {
    const signed = await signTransactions([txn])
    const first = signed[0]
    if (!first) throw new Error('The wallet did not return a signature')
    completeLogin(address, walletId, arc14Header(first))
  } finally {
    authStore.inWalletSignature = false
  }
}

async function signInWithWallet(wallet: Wallet) {
  if (busy.value) return
  busy.value = `wallet:${wallet.id}`
  walletError.value = ''
  try {
    let address: string | undefined
    if (wallet.isConnected) {
      if (!wallet.isActive) {
        wallet.setActive()
        await nextTick()
      }
      address = wallet.activeAccount?.address ?? wallet.accounts[0]?.address
    } else {
      const accounts = await wallet.connect()
      address = accounts[0]?.address
    }
    if (!address) throw new Error('The wallet did not return an account')
    await authenticateWithWallet(wallet.id, address)
  } catch (e) {
    walletError.value = errorMessage(e)
    notify({ severity: 'error', message: walletError.value })
  } finally {
    busy.value = ''
  }
}

async function disconnectWallet(wallet: Wallet) {
  walletError.value = ''
  try {
    await wallet.disconnect()
  } catch (e) {
    walletError.value = errorMessage(e)
    notify({ severity: 'error', message: walletError.value })
  }
}

function cancelSignature() {
  authStore.signaturePromise?.reject(new Error('Signing cancelled by user'))
  password.value = ''
  signError.value = ''
}

async function signWithArc76() {
  if (busy.value || password.value.length < ARC76_MIN_PASSWORD_LENGTH) return
  busy.value = 'sign'
  signError.value = ''
  try {
    const account = await deriveArc76Account(authStore.arc76email, password.value)
    if (account.addr.toString() !== authStore.account) {
      signError.value = 'Password is invalid'
      notify({ severity: 'error', message: signError.value })
      return
    }
    const signed = authStore.usignedTxs.map((tx) =>
      algosdk.decodeUnsignedTransaction(tx).signTxn(account.sk)
    )
    password.value = ''
    authStore.signaturePromise?.resolve(signed)
  } catch (e) {
    signError.value = errorMessage(e)
    notify({ severity: 'error', message: signError.value })
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section
    v-if="showAuthentication"
    v-bind="$attrs"
    class="aa-root aa-screen"
    :style="screenStyle"
    data-testid="aa-screen"
  >
    <div class="aa-panel aa-panel--form" :class="{ 'aa-panel--full': authStore.inRegistration }">
      <form class="aa-card" novalidate @submit.prevent="authArc76Auth">
        <h2 class="aa-title" data-testid="aa-title">
          {{ authStore.inRegistration ? 'Registration' : 'Sign in' }}
        </h2>
        <p class="aa-subtitle">
          {{
            authStore.inRegistration
              ? 'Create an ARC-76 account from your email and a strong password.'
              : 'Use your email and password, or connect a wallet.'
          }}
        </p>

        <AaField
          id="e"
          v-model="authStore.arc76email"
          label="Email"
          type="email"
          autocomplete="username"
          placeholder="Please write your email"
        />
        <AaField
          id="p"
          v-model="password"
          label="Password"
          type="password"
          :autocomplete="authStore.inRegistration ? 'new-password' : 'current-password'"
          placeholder="Please write your password"
        />
        <AaField
          v-if="authStore.inRegistration"
          id="p2"
          v-model="password2"
          label="Password confirmation"
          type="password"
          autocomplete="new-password"
          placeholder="Please repeat your password"
        />

        <AaAlert v-if="password && currentFormError" data-testid="aa-form-error">
          {{ currentFormError }}
        </AaAlert>

        <button type="submit" class="aa-btn aa-btn--primary aa-btn--block" :disabled="!canSubmit">
          <span v-if="busy === 'arc76'" class="aa-spinner" aria-hidden="true" />
          {{ busy === 'arc76' ? 'Deriving key…' : 'Continue' }}
        </button>

        <div class="aa-actions">
          <template v-if="authStore.inRegistration">
            <button
              type="button"
              class="aa-btn aa-btn--secondary"
              @click="authStore.inRegistration = false"
            >
              Back to sign in
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              class="aa-btn aa-btn--secondary"
              @click="authStore.inRegistration = true"
            >
              Register
            </button>
            <button
              type="button"
              class="aa-btn aa-btn--secondary"
              @click="authStore.inAuthentication = false"
            >
              Go back
            </button>
          </template>
        </div>
      </form>
    </div>

    <div v-if="!authStore.inRegistration" class="aa-panel aa-panel--wallets">
      <div class="aa-wallets" data-testid="aa-wallets">
        <h2 class="aa-wallets-title">Or connect with</h2>

        <div v-if="pendingWallet" class="aa-session" data-testid="aa-session">
          <p class="aa-session-label">Connected with {{ pendingWallet.metadata.name }}</p>
          <p class="aa-session-address" :title="activeAddress ?? ''">
            {{ activeAddress ? shortAddress(activeAddress) : '' }}
          </p>
          <button
            type="button"
            class="aa-btn aa-btn--light aa-btn--block"
            :disabled="!!busy"
            data-testid="aa-session-continue"
            @click="signInWithWallet(pendingWallet)"
          >
            <span v-if="busy" class="aa-spinner aa-spinner--dark" aria-hidden="true" />
            Sign in with {{ pendingWallet.metadata.name }}
          </button>
          <button type="button" class="aa-link" @click="disconnectWallet(pendingWallet)">
            Disconnect from {{ pendingWallet.metadata.name }}
          </button>
        </div>

        <ul v-else-if="visibleWallets.length" class="aa-wallet-list">
          <li v-for="wallet in visibleWallets" :key="wallet.walletKey">
            <button
              type="button"
              class="aa-wallet"
              :disabled="!!busy"
              :data-testid="`aa-wallet-${wallet.id}`"
              :title="wallet.metadata.name"
              @click="signInWithWallet(wallet)"
            >
              <img
                class="aa-wallet-icon"
                :src="wallet.metadata.icon"
                :alt="`${wallet.metadata.name} logo`"
                width="36"
                height="36"
              />
              <span class="aa-wallet-name">{{ wallet.metadata.name }}</span>
              <span
                v-if="busy === `wallet:${wallet.id}`"
                class="aa-spinner"
                role="status"
                aria-label="Connecting"
              />
              <svg
                v-else
                class="aa-chevron"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m9 6 6 6-6 6"
                />
              </svg>
            </button>
          </li>
        </ul>
        <p v-else class="aa-empty">No wallets are available for this network.</p>

        <AaAlert v-if="walletError" data-testid="aa-wallet-error">{{ walletError }}</AaAlert>
      </div>
    </div>
  </section>

  <slot v-else />

  <div
    v-if="authStore.inArc76Signature"
    v-bind="showAuthentication ? {} : $attrs"
    class="aa-root aa-overlay"
    data-testid="aa-sign-dialog"
  >
    <form
      class="aa-card aa-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aa-sign-title"
      novalidate
      @submit.prevent="signWithArc76"
      @keydown.esc="cancelSignature"
    >
      <h2 id="aa-sign-title" class="aa-title">
        Sign {{ authStore.usignedTxs.length }}
        {{ authStore.usignedTxs.length === 1 ? 'transaction' : 'transactions' }}
      </h2>
      <p class="aa-subtitle">
        Enter your password to sign as {{ shortAddress(authStore.account) }}.
      </p>
      <AaField
        id="aa-sign-password"
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        placeholder="Please write your password"
        autofocus
      />
      <AaAlert v-if="signError" data-testid="aa-sign-error">{{ signError }}</AaAlert>
      <div class="aa-actions aa-actions--end">
        <button type="button" class="aa-btn aa-btn--secondary" @click="cancelSignature">
          Cancel
        </button>
        <button
          type="submit"
          class="aa-btn aa-btn--primary"
          :disabled="password.length < ARC76_MIN_PASSWORD_LENGTH || !!busy"
        >
          <span v-if="busy === 'sign'" class="aa-spinner" aria-hidden="true" />
          {{ busy === 'sign' ? 'Signing…' : 'Continue' }}
        </button>
      </div>
    </form>
  </div>
</template>
