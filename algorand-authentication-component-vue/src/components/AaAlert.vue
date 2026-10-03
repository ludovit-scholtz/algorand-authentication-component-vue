<script setup lang="ts">
withDefaults(defineProps<{ severity?: 'error' | 'success' | 'info' | 'warn' }>(), {
  severity: 'error'
})
</script>

<template>
  <div
    class="aa-alert"
    :class="`aa-alert--${severity}`"
    :role="severity === 'error' ? 'alert' : 'status'"
  >
    <slot />
  </div>
</template>
