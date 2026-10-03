<script setup lang="ts">
import { computed, reactive } from 'vue'
import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import { useNetwork, useWallet } from '@txnlab/use-wallet-vue'
import {
  AlgorandAuthentication,
  useAVMAuthentication,
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
  signing: false
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

          <template v-if="state.lastSignedTransaction">
            <label for="lastSigned" class="mt-4 block text-sm font-medium text-gray-600">
              Last signed transaction
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

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              :class="primaryButton"
              :disabled="state.signing"
              data-testid="sign"
              @click="signTx"
            >
              Sign
            </button>
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
      </section>
    </main>
  </AlgorandAuthentication>
</template>
