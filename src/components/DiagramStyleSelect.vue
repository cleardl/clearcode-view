<script setup lang="ts">
import { onMounted } from 'vue';
import { useDisplayPreferences } from '../themes/display.js';

const preferences = useDisplayPreferences();
const rendererId = preferences.rendererId;
onMounted(() => { void preferences.initialize(); });
function change(event: Event) { preferences.selectRenderer((event.target as HTMLSelectElement).value); }
</script>

<template>
  <label v-if="preferences.renderers.length > 1" class="ccv-display-settings">
    <span>图表风格</span>
    <select :value="rendererId" aria-label="图表风格" title="应用到所有图表，并记住选择" @change="change">
      <option v-for="renderer in preferences.renderers" :key="renderer.id" :value="renderer.id">{{ renderer.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.ccv-display-settings { display: flex; align-items: center; gap: 8px; margin: 0 12px; font: inherit; }
.ccv-display-settings span { font-size: 12px; opacity: .65; }
.ccv-display-settings select { appearance: auto; max-width: 205px; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; background-color: transparent; color: inherit; font: inherit; font-size: 12px; text-overflow: ellipsis; cursor: pointer; }
.ccv-display-settings select:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
@media (max-width: 767px) {
  .ccv-display-settings { margin: 0 8px; }
  .ccv-display-settings span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .ccv-display-settings select { max-width: 155px; }
}
</style>
