import { reactive } from 'vue'

export interface Toast {
  id: number
  severity: 'error' | 'success' | 'info' | 'warn'
  message: string
}

export const toasts = reactive<Toast[]>([])
let nextId = 1

export function dismissToast(id: number) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

export function addToast(severity: Toast['severity'] | undefined, message: string, life = 6000) {
  const id = nextId++
  toasts.push({ id, severity: severity ?? 'info', message })
  setTimeout(() => dismissToast(id), life)
}
