import AlgorandAuthentication from './components/AlgorandAuthentication.vue'

import type { IAuthenticationStore, Account, INotification } from './types'
export type { IAuthenticationStore, Account, INotification }

import { useAVMAuthentication } from './scripts/useAVMAuthentication'
export type { IAVMAuthentication, TransactionSigner } from './scripts/useAVMAuthentication'
import arc14, { arc14Header } from './scripts/arc14'
import { deriveArc76Account } from './scripts/arc76'

export { AlgorandAuthentication, useAVMAuthentication, arc14, arc14Header, deriveArc76Account }
