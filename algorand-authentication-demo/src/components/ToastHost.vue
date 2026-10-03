<script setup lang="ts">
import { dismissToast, toasts } from '../toast'

const styles = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-green-50 text-green-800 ring-green-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200'
} as const
</script>

<template>
  <div
    class="pointer-events-none fixed top-4 right-4 z-[2000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    aria-live="polite"
    data-testid="toasts"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex items-start gap-3 rounded-lg p-3 text-sm shadow-lg ring-1"
      :class="styles[toast.severity]"
      :role="toast.severity === 'error' ? 'alert' : 'status'"
      :data-testid="`toast-${toast.severity}`"
    >
      <span class="flex-1 break-words">{{ toast.message }}</span>
      <button
        type="button"
        class="cursor-pointer leading-none opacity-60 hover:opacity-100"
        aria-label="Dismiss"
        @click="dismissToast(toast.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
