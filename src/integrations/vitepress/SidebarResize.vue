<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useSidebar } from 'vitepress/theme';

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const props = withDefaults(defineProps<{ storageKey?: string }>(), {
  storageKey: 'clearcode-view-sidebar-width',
});
const { hasSidebar } = useSidebar();
const width = ref(DEFAULT_WIDTH);
const dragging = ref(false);
let pointerId: number | undefined;
let startX = 0;
let startWidth = DEFAULT_WIDTH;

function setWidth(value: number) {
  width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
  document.documentElement.style.setProperty('--ccv-sidebar-width', `${width.value}px`);
}

function saveWidth() {
  try {
    localStorage.setItem(props.storageKey, String(width.value));
  } catch (error) {
    console.warn('[clearcode-view] 无法保存目录宽度。', error);
  }
}

function beginResize(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  handle.focus();
  handle.setPointerCapture(event.pointerId);
  pointerId = event.pointerId;
  startX = event.clientX;
  startWidth = width.value;
  dragging.value = true;
  document.documentElement.classList.add('ccv-sidebar-resizing');
}

function resize(event: PointerEvent) {
  if (dragging.value && event.pointerId === pointerId) {
    setWidth(startWidth + event.clientX - startX);
  }
}

function endResize(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return;
  dragging.value = false;
  pointerId = undefined;
  document.documentElement.classList.remove('ccv-sidebar-resizing');
  if (event.type === 'pointercancel') setWidth(startWidth);
  else saveWidth();
}

function resetWidth() {
  setWidth(DEFAULT_WIDTH);
  saveWidth();
}

function onKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 32 : 8;
  const positions: Record<string, number> = {
    ArrowLeft: width.value - step,
    ArrowRight: width.value + step,
    Home: MIN_WIDTH,
    End: MAX_WIDTH,
  };
  const next = positions[event.key];
  if (next === undefined) return;
  event.preventDefault();
  setWidth(next);
  saveWidth();
}

onMounted(() => {
  try {
    const stored = localStorage.getItem(props.storageKey);
    if (stored !== null) {
      const value = Number(stored);
      if (Number.isFinite(value) && value >= MIN_WIDTH && value <= MAX_WIDTH) setWidth(value);
      else console.warn('[clearcode-view] 已保存的目录宽度无效：', stored);
    }
  } catch (error) {
    console.warn('[clearcode-view] 无法读取目录宽度。', error);
  }
});

onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('--ccv-sidebar-width');
  document.documentElement.classList.remove('ccv-sidebar-resizing');
});
</script>

<template>
  <div
    v-if="hasSidebar"
    class="ccv-sidebar-resize"
    :class="{ dragging }"
    role="separator"
    aria-label="调整目录宽度"
    aria-controls="VPSidebarNav"
    aria-orientation="vertical"
    :aria-valuemin="MIN_WIDTH"
    :aria-valuemax="MAX_WIDTH"
    :aria-valuenow="width"
    :aria-valuetext="`${width} 像素`"
    tabindex="0"
    title="拖动调整目录宽度，双击恢复默认"
    @pointerdown="beginResize"
    @pointermove="resize"
    @pointerup="endResize"
    @pointercancel="endResize"
    @lostpointercapture="endResize"
    @keydown="onKeydown"
    @dblclick="resetWidth"
  />
</template>

<style scoped>
.ccv-sidebar-resize { display: none; }

@media (min-width: 960px) {
  .ccv-sidebar-resize {
    display: block;
    position: fixed;
    top: calc(var(--vp-layout-top-height, 0px) + var(--vp-nav-height));
    bottom: 0;
    left: calc(var(--vp-sidebar-width) - 4px);
    z-index: calc(var(--vp-z-index-sidebar) + 1);
    width: 8px;
    cursor: col-resize;
    touch-action: none;
    user-select: none;
  }

  .ccv-sidebar-resize::after {
    content: '';
    position: absolute;
    inset: 0 3px;
    background: var(--vp-c-divider);
  }

  .ccv-sidebar-resize:hover::after,
  .ccv-sidebar-resize:focus-visible::after,
  .ccv-sidebar-resize.dragging::after {
    inset-inline: 2px;
    background: var(--vp-c-brand-1);
  }

  .ccv-sidebar-resize:focus-visible { outline: none; }
}
</style>
