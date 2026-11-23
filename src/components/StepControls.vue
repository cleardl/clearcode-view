<script setup lang="ts">
import type { ReadingStep } from '../core/model.js';
defineProps<{ steps: ReadingStep[]; index: number; disabled?: boolean }>();
const emit = defineEmits<{ change: [index: number] }>();
function select(event: Event) { emit('change', Number((event.target as HTMLSelectElement).value)); }
</script>

<template>
  <div class="ccv-steps" aria-label="分步阅读">
    <button type="button" :disabled="disabled || index <= 0" @click="emit('change', index - 1)">← 上一步</button>
    <select :value="index" aria-label="阅读步骤" :disabled="disabled" @change="select">
      <option v-for="(step, position) in steps" :key="step.id" :value="position">{{ String(position + 1).padStart(2, '0') }} · {{ step.title }}</option>
    </select>
    <span class="ccv-counter" aria-live="polite">{{ index + 1 }} / {{ steps.length }}</span>
    <button type="button" :disabled="disabled || index >= steps.length - 1" @click="emit('change', index + 1)">下一步 →</button>
  </div>
</template>
