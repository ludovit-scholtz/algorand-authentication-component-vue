<script setup lang="ts">
import { computed, reactive } from 'vue'
import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import { useNetwork, useWallet } from '@txnlab/use-wallet-vue'
import {
  AlgorandAuthentication,
  useAVMAuthentication,
  verifyArc60,
  type INotification
} from 'algorand-authentication-component-vue'

import ToastHost from './components/ToastHost.vue'
import { addToast } from './toast'

const auth = useAVMAuthentication()
const { algodClient } = useWallet()
const { activeNetwork, networkConfig, setActiveNetwork } = useNetwork()

const networks = computed(() => Object.keys(networkConfig))

const state = reactive({
  requireAuthentication: true,
  lastSignedTransaction: '',
  signing: false,
  dataToSign: 'Hello from the Algorand Authentication Demo',
  signingData: false,
  dataSignature: null as null | {
    signer: string
    domain: string
    signature: string
    valid: boolean
  }
})

function onNotification(e: INotification) {
  addToast(e.severity, e.message)
}

async function signTx() {
  state.signing = true
  try {
    const params = await algodClient.value.getTransactionParams().do()
    const tx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      amount: 0,
      sender: auth.authStore.account,
      receiver: auth.authStore.account,
      note: new TextEncoder().encode('algorand-authentication-demo'),
      suggestedParams: { ...params, fee: 0, flatFee: true }
    })
    const signed = await auth.sign([tx], [0])
    state.lastSignedTransaction = Buffer.from(signed[0]).toString('base64')
    addToast('success', 'Transaction signed')
  } catch (e) {
    addToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    state.signing = false
  }
}

async function signRawData() {
  state.signingData = true
  state.dataSignature = null
  try {
    // ARC-60: the payload travels base64 encoded
    const data = Buffer.from(state.dataToSign, 'utf-8').toString('base64')
    const res = await auth.signData(data)
    state.dataSignature = {
      signer: algosdk.encodeAddress(res.signer),
      domain: res.domain,
      signature: Buffer.from(res.signature).toString('base64'),
      valid: await verifyArc60(res)
    }
    addToast('success', 'Data signed')
  } catch (e) {
    addToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    state.signingData = false
  }
}

async function changeNetwork(event: Event) {
  try {
    await setActiveNetwork((event.target as HTMLSelectElement).value)
  } catch (e) {
    addToast('error', e instanceof Error ? e.message : String(e))
  }
}

const primaryButton =
  'inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton =
  'inline-flex cursor-pointer items-center justify-center rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
</script>

<template>
  <ToastHost />
  <AlgorandAuthentication
    arc14Realm="Demo"
    cover-image="/auth-cover.jpg"
    :authorizedOnlyAccess="state.requireAuthentication"
    @onNotification="onNotification"
  >
    <main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">Algorand Authentication Demo</h1>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          Network
          <select
            class="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900"
            data-testid="network-select"
            :value="activeNetwork"
            @change="changeNetwork"
          >
            <option v-for="id in networks" :key="id" :value="id">{{ id }}</option>
          </select>
        </label>
      </header>

      <section
        v-if="!auth.authStore.isAuthenticated"
        class="rounded-lg bg-white p-6 shadow-md"
        data-testid="unauthenticated"
      >
        <h2 class="text-xl font-semibold">Unauthenticated Content</h2>
        <p class="mt-2 text-gray-600">This page can be viewed without signing in.</p>
        <button
          type="button"
          :class="[primaryButton, 'mt-4']"
          data-testid="login"
          @click="auth.authenticate()"
        >
          Login
        </button>
        <button
          type="button"
          :class="[secondaryButton, 'mt-4 ml-2']"
          data-testid="toggle-requirement"
          @click="state.requireAuthentication = true"
        >
          Require authentication
        </button>
      </section>

      <section v-else class="flex flex-col gap-6" data-testid="authenticated">
        <div class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="text-xl font-semibold">Authenticated Content</h2>
          <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-[10rem_1fr]">
            <dt class="font-medium text-gray-600">Email</dt>
            <dd class="break-all" data-testid="auth-email">
              {{ auth.authStore.arc76email || '—' }}
            </dd>
            <dt class="font-medium text-gray-600">Account</dt>
            <dd class="font-mono break-all" data-testid="auth-account">
              {{ auth.authStore.account }}
            </dd>
            <dt class="font-medium text-gray-600">Wallet provider</dt>
            <dd data-testid="auth-wallet">{{ auth.authStore.wallet }}</dd>
          </dl>

          <label for="arc14Header" class="mt-6 block text-sm font-medium text-gray-600">
            ARC-14 Authorization header
          </label>
          <textarea
            id="arc14Header"
            readonly
            rows="5"
            class="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 p-2 font-mono text-xs"
            data-testid="auth-header"
            :value="auth.authStore.arc14Header"
          />

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              :class="secondaryButton"
              data-testid="logout"
              @click="auth.logout()"
            >
              Logout
            </button>
            <button
              type="button"
              :class="secondaryButton"
              data-testid="toggle-requirement"
              @click="state.requireAuthentication = !state.requireAuthentication"
            >
              {{ state.requireAuthentication ? 'Disable' : 'Enable' }} authentication requirement
            </button>
          </div>
        </div>

        <div class="rounded-lg bg-white p-6 shadow-md" data-testid="sign-tx-card">
          <h2 class="text-xl font-semibold">Sign a transaction</h2>
          <p class="mt-1 text-sm text-gray-600">
            Builds a zero-amount payment on the selected network and signs it with
            <code>auth.sign([txn], [0])</code>: your wallet asks for approval, an ARC-76 account
            asks for its password.
          </p>
          <button
            type="button"
            :class="[primaryButton, 'mt-4']"
            :disabled="state.signing"
            data-testid="sign"
            @click="signTx"
          >
            Sign transaction
          </button>
          <template v-if="state.lastSignedTransaction">
            <label for="lastSigned" class="mt-4 block text-sm font-medium text-gray-600">
              Signed transaction (base64)
            </label>
            <textarea
              id="lastSigned"
              readonly
              rows="4"
              class="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 p-2 font-mono text-xs"
              data-testid="signed-tx"
              :value="state.lastSignedTransaction"
            />
          </template>
        </div>

        <div class="rounded-lg bg-white p-6 shadow-md" data-testid="sign-data-card">
          <h2 class="text-xl font-semibold">Sign raw data (ARC-60)</h2>
          <p class="mt-1 text-sm text-gray-600">
            Signs arbitrary bytes with <code>auth.signData(base64)</code>. The signature covers
            <code>SHA-256(data) || SHA-256(SHA-256(domain))</code>, so it cannot be replayed on
            another site.
          </p>
          <label for="dataToSign" class="mt-4 block text-sm font-medium text-gray-600">
            Data to sign
          </label>
          <textarea
            id="dataToSign"
            v-model="state.dataToSign"
            rows="2"
            class="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
            data-testid="data-input"
          />
          <button
            type="button"
            :class="[primaryButton, 'mt-3']"
            :disabled="state.signingData || !state.dataToSign || !auth.canSignData()"
            data-testid="sign-data"
            @click="signRawData"
          >
            Sign data
          </button>
          <p
            v-if="!auth.canSignData()"
            class="mt-2 text-sm text-amber-700"
            data-testid="sign-data-unsupported"
          >
            {{ auth.authStore.wallet }} cannot sign arbitrary data.
          </p>
          <dl
            v-if="state.dataSignature"
            class="mt-4 grid gap-2 text-sm sm:grid-cols-[8rem_1fr]"
            data-testid="data-result"
          >
            <dt class="font-medium text-gray-600">Signer</dt>
            <dd class="font-mono break-all" data-testid="data-signer">
              {{ state.dataSignature.signer }}
            </dd>
            <dt class="font-medium text-gray-600">Domain</dt>
            <dd data-testid="data-domain">{{ state.dataSignature.domain }}</dd>
            <dt class="font-medium text-gray-600">Signature</dt>
            <dd class="font-mono break-all text-xs" data-testid="data-signature">
              {{ state.dataSignature.signature }}
            </dd>
            <dt class="font-medium text-gray-600">Verified</dt>
            <dd data-testid="data-valid">
              {{ state.dataSignature.valid ? 'valid ✓' : 'INVALID ✗' }}
            </dd>
          </dl>
        </div>
      </section>
    </main>
  </AlgorandAuthentication>
</template>
