<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';
import type { PanzoomObject } from '@panzoom/panzoom';
import type { DiagramModel, ElementRef } from '../core/model.js';
import { visibleReference, type DiagramGraph } from '../core/graph.js';
import { validateGraphReferences } from '../core/validate.js';
import { parseMermaid } from '../mermaid/parse.js';
import { archifyRenderer } from '../renderers/archify.js';
import { renderScene, validateMountedDiagram } from '../renderers/render.js';
import type { DiagramRenderer, BoundElements, LegendEntry, MountedDiagram } from '../renderers/model.js';
import StepControls from './StepControls.vue';
import InspectorPanel from './InspectorPanel.vue';
import { themeOptionsKey } from '../themes/context.js';
import { defaultThemes } from '../themes/presets.js';
import type { ClearcodeTheme } from '../themes/model.js';
import { displayPreferencesKey } from '../themes/display.js';

const props = defineProps<{ model: DiagramModel; theme?: ClearcodeTheme; renderer?: DiagramRenderer }>();
const options = inject(themeOptionsKey, {});
const preferences = inject(displayPreferencesKey, undefined);
const availableThemes = computed(() => props.theme ? [props.theme] : options.themes || defaultThemes);
const selectedTheme = computed(() => props.theme || (preferences?.colorScheme.value ? availableThemes.value.find(value => value.colorScheme === preferences.colorScheme.value) : undefined) || availableThemes.value.find(value => value.id === options.theme) || availableThemes.value[0]);
const availableRenderers = computed(() => props.renderer ? [props.renderer] : options.renderers || [options.renderer || archifyRenderer]);
const renderer = computed(() => props.renderer || availableRenderers.value.find(value => value.id === preferences?.rendererId.value) || options.renderer || availableRenderers.value[0]);
const theme = computed(() => renderer.value.resolveTheme?.(selectedTheme.value) || selectedTheme.value);
const legend = shallowRef<LegendEntry[]>([]);
const root = ref<HTMLElement>(), canvas = ref<HTMLElement>(), stage = ref<HTMLElement>();
const metadata = shallowRef<DiagramGraph>();
const bound = shallowRef<BoundElements>(new Map());
const current = ref(0), selected = ref<ElementRef>(), mode = ref<'step' | 'selection'>(props.model.steps.length ? 'step' : 'selection');
const active = ref(false), busy = ref(true), error = ref(''), panelWidth = ref(330);
const inspectorVisible = ref(true);
const collapsed = ref<Record<string, boolean>>({});
const instanceId = 'ccv-' + useId().replace(/[^A-Za-z0-9_-]/g, '');
let camera: PanzoomObject | undefined, observer: ResizeObserver | undefined;
let mountedDiagram: MountedDiagram | undefined;
let generation = 0, disposed = false, ready = false, initialView = true;
let resizing: { x: number; width: number } | undefined;

const swimlanes = computed(() => !!metadata.value && [...metadata.value.elements.values()].some(item => item.classes?.includes('ccv-swimlane')));
const title = computed(() => swimlanes.value ? '职责泳道' : props.model.type === 'sequence' ? '交互时序' : props.model.type === 'block' ? '分层架构' : props.model.type === 'flowchart' ? '架构与流程' : '图表');
const step = computed(() => mode.value === 'step' ? props.model.steps[current.value] : undefined);
const focused = computed(() => step.value?.focus || (selected.value ? [selected.value] : []));
const section = computed(() => {
  const target = step.value ? step.value.ref : selected.value ? props.model.details[selected.value] : props.model.overview;
  return target ? props.model.sections[target] : undefined;
});
const inspectorTitle = computed(() => step.value?.title || section.value?.title || (selected.value ? metadata.value?.elements.get(selected.value)?.label : undefined) || '图形解读');
const link = computed(() => mode.value === 'selection' && selected.value ? props.model.links[selected.value]?.replace(/\.md(?=#|$)/, '.html') : undefined);
const hasInspector = computed(() => !!props.model.overview || props.model.steps.length > 0 || Object.keys(props.model.details).length > 0 || Object.keys(props.model.links).length > 0);
const hiddenSelection = computed(() => !!metadata.value && focused.value.some(value => visibleReference(value, metadata.value!, collapsed.value) !== value));

function savePosition() {
  const url = new URL(window.location.href), prefix = `ccv.${props.model.id}.`;
  url.searchParams.delete(prefix + 'renderer');
  if (step.value) url.searchParams.set(prefix + 'step', step.value.id);
  else url.searchParams.delete(prefix + 'step');
  if (mode.value === 'selection' && selected.value) url.searchParams.set(prefix + 'select', selected.value);
  else url.searchParams.delete(prefix + 'select');
  if (readingAnchor(url.hash) && section.value) {
    const target = document.getElementById(section.value.ref.slice(1));
    if (target?.dataset.ccvReadingDiagram === props.model.id) url.hash = target.id;
  }
  window.history.replaceState(window.history.state, '', url);
}

function restorePosition() {
  const params = new URLSearchParams(window.location.search), prefix = `ccv.${props.model.id}.`;
  const index = props.model.steps.findIndex(value => value.id === params.get(prefix + 'step'));
  if (index >= 0) current.value = index;
  const requested = params.get(prefix + 'select');
  if (requested && metadata.value?.elements.has(requested as ElementRef)) { selected.value = requested as ElementRef; mode.value = 'selection'; }
}

function readingAnchor(hash: string) {
  if (!hash) return undefined;
  let id: string;
  try { id = decodeURIComponent(hash.slice(1)); }
  catch (error) { if (error instanceof URIError) return undefined; throw error; }
  const anchor = document.getElementById(id);
  return anchor?.dataset.ccvReadingDiagram === props.model.id ? anchor : undefined;
}

/** A sidebar-only heading link opens its explanation instead of scrolling to empty prose. */
function revealReadingAnchor() {
  const target = readingAnchor(window.location.hash)?.dataset.ccvReadingRef;
  if (!target || !props.model.sections[target]) return;
  const index = props.model.steps.findIndex(value => value.ref === target);
  selected.value = undefined;
  if (index >= 0) { current.value = index; mode.value = 'step'; }
  else {
    selected.value = Object.entries(props.model.details).find(([, ref]) => ref === target)?.[0] as ElementRef | undefined;
    mode.value = 'selection';
  }
  inspectorVisible.value = true;
  savePosition();
  root.value?.scrollIntoView({ block: 'start' });
}

function followReadingLink(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
  const link = event.target.closest('a[href]');
  if (!link || link.hasAttribute('download') || (link.getAttribute('target') && link.getAttribute('target') !== '_self')) return;
  const url = new URL(link.getAttribute('href')!, window.location.href);
  const path = (value: string) => value.replace(/\.html$/, '').replace(/\/$/, '');
  if (url.origin !== window.location.origin || path(url.pathname) !== path(window.location.pathname) || !readingAnchor(url.hash)) return;
  event.preventDefault(); event.stopPropagation();
  const next = new URL(window.location.href);
  next.hash = url.hash;
  if (next.href !== window.location.href) window.history.pushState(window.history.state, '', next);
  revealReadingAnchor();
}

function setActive(value: boolean) {
  active.value = value;
  camera?.setOptions({ disablePan: !value, disableZoom: !value, touchAction: value ? 'none' : 'auto', cursor: value ? 'grab' : 'default' });
}

function highlight() {
  const graph = metadata.value;
  if (!graph) return;
  const refs = new Set(focused.value.map(value => visibleReference(value, graph, collapsed.value)));
  for (const [value, elements] of bound.value) for (const element of elements) {
    element.classList.toggle('ccv-highlight', refs.has(value));
    element.classList.toggle('ccv-muted-element', refs.size > 0 && !refs.has(value) && (value.startsWith('edge:') || value.startsWith('message:')));
    if (element.getAttribute('role') === 'button') element.setAttribute('aria-pressed', String(refs.has(value)));
  }
}

function fittedView(frame: HTMLElement, content: HTMLElement, overview: boolean, reading = false) {
  const width = content.offsetWidth, height = content.offsetHeight;
  const fitted = Math.max(0.05, Math.min((frame.clientWidth - 40) / width, overview ? (frame.clientHeight - 40) / height : 1.2, 1.2));
  const scale = reading ? Math.max(mountedDiagram?.readingScale ?? 2 / 3, fitted) : fitted;
  const x = reading ? Math.max(0, (width * scale - frame.clientWidth + 40) / (2 * scale)) : 0;
  const y = overview ? 0 : Math.max(0, (height * scale - frame.clientHeight + 40) / (2 * scale));
  return { x, y, scale };
}

function fit(overview = true, reading = false) {
  if (!canvas.value || !stage.value || !camera) return;
  const view = fittedView(canvas.value, stage.value, overview, reading);
  camera.zoom(view.scale, { force: true, animate: false });
  camera.pan(view.x, view.y, { force: true, animate: false });
}

function zoom(factor: number) { canvas.value?.focus({ preventScroll: true }); camera?.zoom(camera.getScale() * factor, { force: true }); }
function locate() {
  const graph = metadata.value, viewport = canvas.value;
  if (!graph || !viewport || !camera) return;
  const visible = focused.value.map(value => visibleReference(value, graph, collapsed.value));
  const element = visible.flatMap(value => bound.value.get(value) || [])[0];
  if (!element) return;
  const box = element.getBoundingClientRect(), frame = viewport.getBoundingClientRect(), pan = camera.getPan(), scale = camera.getScale();
  camera.pan(pan.x + (frame.left + frame.width / 2 - box.left - box.width / 2) / scale, pan.y + (frame.top + frame.height / 2 - box.top - box.height / 2) / scale, { force: true });
}

async function draw() {
  if (!ready || !stage.value || !canvas.value) return;
  const ticket = ++generation;
  busy.value = true; error.value = '';
  const previous = camera ? { ...camera.getPan(), scale: camera.getScale() } : undefined;
  const model = props.model, backend = renderer.value, appearance = selectedTheme.value;
  const view = initialView ? undefined : { ...collapsed.value };
  try {
    const [prepared, { default: Panzoom }] = await Promise.all([
      parseMermaid(model).then(async diagram => {
        validateGraphReferences(model, diagram.graph);
        const scene = await renderScene(backend, diagram, { id: `${instanceId}-${ticket}`, collapsed: view, theme: appearance });
        return { diagram, scene };
      }),
      import('@panzoom/panzoom'),
    ]);
    if (disposed || ticket !== generation || !stage.value || !canvas.value) return;
    releaseDrawing();
    stage.value.innerHTML = prepared.scene.svg;
    const svg = stage.value.querySelector('svg');
    if (!svg) throw new Error(`渲染后端 ${backend.id} 没有返回图形`);
    const box = svg.viewBox.baseVal;
    stage.value.style.width = `${box.width}px`; stage.value.style.height = `${box.height}px`;
    svg.style.maxWidth = 'none'; svg.setAttribute('width', String(box.width)); svg.setAttribute('height', String(box.height));
    metadata.value = prepared.diagram.graph;
    if (initialView) collapsed.value = Object.fromEntries(prepared.diagram.graph.groups.map(group => [group.id, group.collapsed]));
    mountedDiagram = prepared.scene.mount(svg);
    stage.value.style.width = `${svg.viewBox.baseVal.width}px`; stage.value.style.height = `${svg.viewBox.baseVal.height}px`;
    svg.setAttribute('width', String(svg.viewBox.baseVal.width)); svg.setAttribute('height', String(svg.viewBox.baseVal.height));
    validateMountedDiagram(prepared.diagram, mountedDiagram, collapsed.value);
    bound.value = mountedDiagram.bindings;
    legend.value = mountedDiagram.legend;
    const reading = props.model.type === 'sequence' || swimlanes.value;
    const position = initialView || !previous ? fittedView(canvas.value, stage.value, !reading, reading) : previous;
    camera = Panzoom(stage.value, {
      canvas: true, minScale: 0.05, maxScale: 5, step: 0.15, touchAction: 'auto',
      startScale: position.scale, startX: position.x, startY: position.y,
      disablePan: !active.value, disableZoom: !active.value, cursor: active.value ? 'grab' : 'default',
      handleStartEvent: event => { if (active.value) event.preventDefault(); },
    });
    if (initialView) { restorePosition(); revealReadingAnchor(); }
    if (selected.value && !prepared.diagram.graph.elements.has(selected.value)) { selected.value = undefined; mode.value = props.model.steps.length ? 'step' : 'selection'; }
    initialView = false;
    highlight();
  } catch (failure) {
    if (disposed || ticket !== generation) return;
    error.value = failure instanceof Error ? failure.message : String(failure);
    releaseDrawing();
    metadata.value = undefined; bound.value = new Map();
    if (stage.value) stage.value.innerHTML = '';
  } finally { if (!disposed && ticket === generation) busy.value = false; }
}

function releaseDrawing() {
  const drawing = mountedDiagram;
  mountedDiagram = undefined;
  try { drawing?.dispose?.(); }
  finally { camera?.destroy(); camera = undefined; }
}

function changeStep(index: number) {
  if (index < 0 || index >= props.model.steps.length) return;
  current.value = index; mode.value = 'step'; selected.value = undefined; savePosition();
}

function interact(event: MouseEvent | KeyboardEvent) {
  if (busy.value || !(event.target instanceof Element)) return;
  if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
  const toggle = event.target.closest('[data-ccv-toggle]');
  if (toggle) {
    event.preventDefault(); event.stopPropagation();
    const id = toggle.getAttribute('data-ccv-toggle')!;
    collapsed.value = { ...collapsed.value, [id]: !collapsed.value[id] };
    void draw().then(() => stage.value?.querySelector<SVGElement>(`[data-ccv-toggle="${CSS.escape(id)}"]`)?.focus({ preventScroll: true })); return;
  }
  const target = event.target.closest('[data-ccv-ref]');
  const value = target?.getAttribute('data-ccv-ref') as ElementRef | undefined;
  if (value) { event.preventDefault(); event.stopPropagation(); selected.value = value; mode.value = 'selection'; savePosition(); }
}

function focusCanvas() { canvas.value?.focus({ preventScroll: true }); setActive(true); }
function leaveCanvas(event: FocusEvent) { if (!(event.relatedTarget instanceof Node) || !canvas.value?.contains(event.relatedTarget)) setActive(false); }
function wheel(event: WheelEvent) { if (active.value && !busy.value) { event.preventDefault(); camera?.zoomWithWheel(event); } }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setActive(false); canvas.value?.focus(); canvas.value?.blur(); } }
function outside(event: PointerEvent) { if (event.target instanceof Node && !canvas.value?.contains(event.target)) setActive(false); }
function resizeStart(event: PointerEvent) { resizing = { x: event.clientX, width: panelWidth.value }; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }
function resizeMove(event: PointerEvent) {
  if (resizing && root.value) panelWidth.value = Math.max(240, Math.min(root.value.clientWidth * 0.6, resizing.width + resizing.x - event.clientX));
}

watch([focused, bound, collapsed], highlight);
watch(selectedTheme, () => { void draw(); });
watch(renderer, () => { if (ready) { savePosition(); void draw(); } }, { flush: 'sync' });
watch(() => props.model, (value, previous) => {
  if (value.id !== previous.id || value.location.file !== previous.location.file) {
    current.value = 0; selected.value = undefined; mode.value = value.steps.length ? 'step' : 'selection'; initialView = true;
  } else {
    const stepId = previous.steps[current.value]?.id;
    current.value = Math.max(0, value.steps.findIndex(item => item.id === stepId));
  }
  void draw();
});
onMounted(() => {
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('click', followReadingLink, true);
  window.addEventListener('hashchange', revealReadingAnchor);
  window.addEventListener('popstate', revealReadingAnchor);
  observer = new ResizeObserver(() => { if (initialView) fit(); });
  if (canvas.value) observer.observe(canvas.value);
  void (preferences?.initialize() || Promise.resolve()).then(() => { if (!disposed) { ready = true; void draw(); } });
});
onBeforeUnmount(() => {
  disposed = true; generation++;
  document.removeEventListener('pointerdown', outside, true);
  document.removeEventListener('click', followReadingLink, true);
  window.removeEventListener('hashchange', revealReadingAnchor);
  window.removeEventListener('popstate', revealReadingAnchor);
  observer?.disconnect(); releaseDrawing();
});
</script>

<template>
  <section ref="root" class="ccv" :style="[theme.variables, { '--ccv-panel-width': panelWidth + 'px' }]" :aria-label="title" :data-diagram="model.id" :data-theme="theme.id" :data-renderer="renderer.id" :data-kind="model.type">
    <div class="ccv-toolbar">
      <div><h2>{{ title }}</h2></div>
      <div class="ccv-camera-controls" aria-label="画布控制">
        <button v-if="hasInspector" type="button" :aria-pressed="inspectorVisible" @click="inspectorVisible = !inspectorVisible">{{ inspectorVisible ? '收起解读' : '显示解读' }}</button>
        <button type="button" :disabled="busy || !!error" aria-label="缩小" @click="zoom(0.8)">−</button>
        <button type="button" :disabled="busy || !!error" @click="fit()">全图</button>
        <button type="button" :disabled="busy || !!error" @click="fit(false)">适宽</button>
        <button type="button" :disabled="busy || !!error" @click="fit(false, true)">阅读尺寸</button>
        <button type="button" :disabled="busy || !!error || !focused.length" @click="locate">定位当前</button>
        <button type="button" :disabled="busy || !!error" aria-label="放大" @click="zoom(1.25)">+</button>
      </div>
    </div>
    <StepControls v-if="model.steps.length" :steps="model.steps" :index="current" :disabled="busy || !!error" @change="changeStep" />
    <div v-if="legend.length" class="ccv-legend" aria-label="图例">
      <span class="ccv-legend-title">{{ model.type === 'sequence' ? '参与者与消息' : '职责图例' }}</span>
      <span v-for="entry in legend" :key="entry.id" class="ccv-legend-item" :style="entry.role ? { '--ccv-legend-color': `var(--ccv-${entry.role})` } : {}">
        <i :class="entry.line ? ['ccv-legend-line', 'ccv-legend-' + entry.line] : 'ccv-legend-dot'" />{{ entry.label }}
      </span>
    </div>
    <div class="ccv-layout" :class="{ 'ccv-with-inspector': hasInspector && inspectorVisible }">
      <div class="ccv-visual">
        <div ref="canvas" class="ccv-canvas" :class="{ 'ccv-active': active }" tabindex="0" role="group" aria-label="图形画布" :aria-busy="busy"
          @pointerdown.capture="focusCanvas" @focusin="setActive(true)" @focusout="leaveCanvas" @wheel="wheel" @keydown="escape">
          <div ref="stage" class="ccv-stage" @click="interact" @keydown="interact" />
          <div v-if="busy" class="ccv-loading" role="status">正在绘制图形…</div>
          <div v-if="error" class="ccv-error" role="alert"><strong>图形暂时无法显示</strong><pre>{{ error }}</pre></div>
        </div>
        <div class="ccv-canvas-hint">{{ active ? '滚轮缩放 · 拖动画布 · Esc 退出' : '点击或 Tab 进入画布后缩放与拖动' }}<span v-if="model.type === 'flowchart'">节点选择 · 加减号展开</span><span v-else-if="model.type === 'block'">按层阅读 · 选择组件或路线</span><span v-else-if="model.type === 'sequence'">参与者与消息可选择</span></div>
      </div>
      <template v-if="hasInspector && inspectorVisible">
        <div class="ccv-splitter" role="separator" tabindex="0" aria-label="调整解读栏宽度" aria-orientation="vertical" :aria-valuenow="panelWidth" :aria-valuemin="240" :aria-valuemax="600"
          @pointerdown="resizeStart" @pointermove="resizeMove" @pointerup="resizing = undefined" @lostpointercapture="resizing = undefined"
          @keydown.left.prevent="panelWidth = Math.min(600, panelWidth + 24)" @keydown.right.prevent="panelWidth = Math.max(240, panelWidth - 24)" />
        <InspectorPanel :title="inspectorTitle" :section="section" :link="link" :hidden-selection="hiddenSelection" />
      </template>
    </div>
  </section>
</template>

<style src="./style.css"></style>
<style src="../themes/diagram.css"></style>
<style src="../themes/diagram-design.css"></style>
<style src="../themes/archify.css"></style>
<style src="../themes/archify-upstream.css"></style>
