<script setup lang="ts">
import { dismissToast, toasts } from '../toast'

const styles = {
  error: 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30',
  success: 'bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 ring-green-200 dark:ring-green-500/30',
  info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/30',
  warn: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30'
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
