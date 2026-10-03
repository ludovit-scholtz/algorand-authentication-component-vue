<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    type?: 'text' | 'email' | 'password'
    placeholder?: string
    autocomplete?: string
    disabled?: boolean
    autofocus?: boolean
    showLabel?: string
    hideLabel?: string
  }>(),
  {
    showLabel: 'Show password',
    hideLabel: 'Hide password',
    type: 'text',
    placeholder: '',
    autocomplete: 'off',
    disabled: false,
    autofocus: false
  }
)
const model = defineModel<string>({ default: '' })
const revealed = ref(false)
const input = ref<HTMLInputElement | null>(null)

// the native `autofocus` attribute is ignored for elements inserted after page load
onMounted(() => {
  if (props.autofocus) input.value?.focus()
})
</script>

<template>
  <div class="aa-field">
    <label :for="props.id" class="aa-label">{{ props.label }}</label>
    <div class="aa-input-wrap">
      <input
        :id="props.id"
        ref="input"
        v-model="model"
        class="aa-input"
        :class="{ 'aa-input--toggle': props.type === 'password' }"
        :type="props.type === 'password' && revealed ? 'text' : props.type"
        :placeholder="props.placeholder"
        :autocomplete="props.autocomplete"
        :disabled="props.disabled"
        :autofocus="props.autofocus"
        spellcheck="false"
        autocapitalize="none"
      />
      <button
        v-if="props.type === 'password'"
        type="button"
        class="aa-reveal"
        :aria-label="revealed ? props.hideLabel : props.showLabel"
        :aria-pressed="revealed"
        :disabled="props.disabled"
        @click="revealed = !revealed"
      >
        <svg v-if="!revealed" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
          />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
