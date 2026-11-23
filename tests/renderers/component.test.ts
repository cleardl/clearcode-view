/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, shallowRef, type App } from 'vue';
import { createDiagram } from '../../src/core.js';
import { DiagramView, DiagramStyleSelect, clearcodeViewPlugin, useDisplayPreferences, type DisplayPreferences } from '../../src/vue.js';
import { bindSemanticElements, type DiagramRenderer, type RenderedScene } from '../../src/renderers.js';
import { studioTheme, blueprintTheme } from '../../src/themes.js';
import type { MermaidSource } from '../../src/core.js';
import { browserStorage } from '../support/browser-storage.js';

vi.mock('@panzoom/panzoom', () => ({ default: () => ({ getPan: () => ({ x: 12, y: 34 }), getScale: () => 1, setOptions: vi.fn(), zoom: vi.fn(), pan: vi.fn(), destroy: vi.fn() }) }));
vi.mock('../../src/mermaid/parse.js', () => ({ parseMermaid: async (input: MermaidSource) => ({
  input, nativeType: 'flowchart-v2', graph: { type: 'flowchart', groups: [], elements: new Map([
    ['node:A', { ref: 'node:A', label: 'Client', parents: [] }],
    ['node:B', { ref: 'node:B', label: 'Gateway', parents: [] }],
    ['edge:send', { ref: 'edge:send', label: '', parents: [], from: 'A', to: 'B' }],
  ]) },
}) }));

const model = createDiagram({ id: 'direct', source: 'flowchart LR\nA[Client] send@--> B[Gateway]', details: { 'node:B': '#gateway' }, sections: { '#gateway': { ref: '#gateway', title: '请求网关', html: '<p>负责接纳与路由。</p>' } } });
const apps: App[] = [], roots: HTMLElement[] = [];
let removeStorageFrame: () => void;
beforeEach(() => { removeStorageFrame = browserStorage(); });

function setup() {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const root = document.createElement('div');
  document.body.append(root); roots.push(root);
  return root;
}

function scene(diagram: Parameters<DiagramRenderer['render']>[0], dispose: () => void): RenderedScene {
  return {
    svg: '<svg viewBox="0 0 400 120"><g data-ccv-ref="node:A"><rect width="100" height="50"/><text>Client</text></g><g data-ccv-ref="node:B"><rect x="200" width="100" height="50"/><text>Gateway</text></g><path data-ccv-ref="edge:send" d="M100 25H200"/></svg>',
    mount(svg) { return { bindings: bindSemanticElements(svg, diagram.graph, {}, diagram.input.location), legend: [], dispose }; },
  };
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const root of roots.splice(0)) root.remove();
  removeStorageFrame();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('renderer lifecycle in the shared interaction component', () => {
  it('opens sidebar-only deep links, preserves the chosen step on reload and releases link listeners', async () => {
    const root = setup(), scroll = vi.fn();
    const backend: DiagramRenderer = { id: 'host', label: 'Host', supports: () => true, render: async diagram => scene(diagram, vi.fn()) };
    const steps = createDiagram({ ...model, steps: [
      { id: 'client', title: '客户端', focus: ['node:A'], ref: '#client' },
      { id: 'gateway', title: '接收请求', focus: ['node:B'], ref: '#gateway' },
    ], sections: { ...model.sections, '#client': { ref: '#client', title: '客户端', html: '<p>提交请求。</p>' } } });
    window.history.replaceState({}, '', '/#gateway');
    const app = createApp({ render: () => h('div', [
      h('a', { href: '#gateway' }, '查看请求网关'),
      ...['client', 'gateway'].map(id => h('span', { id, hidden: true, 'data-ccv-reading-diagram': 'direct', 'data-ccv-reading-ref': '#' + id })),
      h(DiagramView, { model: steps, renderer: backend }),
    ]) });
    app.mount(root); apps.push(app);
    (root.querySelector('.ccv') as HTMLElement).scrollIntoView = scroll;
    await vi.waitFor(() => expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由'));
    expect(new URLSearchParams(window.location.search).get('ccv.direct.step')).toBe('gateway');
    const choice = root.querySelector<HTMLSelectElement>('select[aria-label="阅读步骤"]')!;
    choice.value = '0'; choice.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(window.location.hash).toBe('#client');
    expect(new URLSearchParams(window.location.search).get('ccv.direct.step')).toBe('client');
    [...root.querySelectorAll<HTMLButtonElement>('.ccv-toolbar button')].find(button => button.textContent === '收起解读')!.click();
    await nextTick();
    expect(root.querySelector('.ccv-inspector')).toBeNull();
    root.querySelector('a')!.click();
    await nextTick();
    expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由');
    expect(window.location.hash).toBe('#gateway');
    expect(choice.value).toBe('1');
    app.unmount(); apps.splice(apps.indexOf(app), 1);
    scroll.mockClear();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(scroll).not.toHaveBeenCalled();
  });

  it('restores one saved style before drawing all diagrams and ignores per-diagram URL styles', async () => {
    const root = setup(), dispose = vi.fn();
    const first: DiagramRenderer = { id: 'first', label: 'Default', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const rich: DiagramRenderer = { id: 'rich', label: 'Rich', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const simple: DiagramRenderer = { id: 'simple', label: 'Simple', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    window.history.replaceState({}, '', '/?ccv.direct.renderer=first&ccv.direct.select=node%3AB');
    window.localStorage.setItem('clearcode-view:renderer', 'rich');
    const app = createApp({ render: () => h('div', [h(DiagramStyleSelect), h(DiagramView, { model }), h(DiagramView, { model: { ...model, id: 'second' } })]) });
    app.use(clearcodeViewPlugin, { renderers: [first, rich, simple] });
    app.mount(root); apps.push(app);
    await vi.waitFor(() => expect(root.querySelector('[data-ccv-ref="node:B"]')?.getAttribute('aria-pressed')).toBe('true'));
    expect(rich.render).toHaveBeenCalledTimes(2);
    expect(first.render).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.ccv-toolbar select')).toHaveLength(0);
    const choice = root.querySelector<HTMLSelectElement>('select[aria-label="图表风格"]')!;
    expect(choice.value).toBe('rich');
    choice.value = 'simple'; choice.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(simple.render).toHaveBeenCalledTimes(2));
    expect([...root.querySelectorAll('.ccv')].map(element => element.getAttribute('data-renderer'))).toEqual(['simple', 'simple']);
    expect(window.localStorage.getItem('clearcode-view:renderer')).toBe('simple');
    expect(new URLSearchParams(window.location.search).get('ccv.direct.renderer')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('ccv.direct.select')).toBe('node:B');
    expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由');
  });
  it('switches registered styles on the same model while preserving selection and releasing the old drawing', async () => {
    const root = setup(), dispose = vi.fn();
    const first: DiagramRenderer = { id: 'first', label: '定制版', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const second: DiagramRenderer = { id: 'second', label: '简洁版', resolveTheme: theme => ({ ...theme, variables: { ...theme.variables, '--ccv-accent': '#bf4520' } }), supports: () => true, render: vi.fn(async diagram => scene(diagram, vi.fn())) };
    const app = createApp({ render: () => h('div', [h(DiagramStyleSelect), h(DiagramView, { model })]) });
    app.use(clearcodeViewPlugin, { renderers: [first, second] });
    app.mount(root); apps.push(app);
    await vi.waitFor(() => expect(root.querySelector('[data-ccv-ref="node:B"]')).not.toBeNull());
    root.querySelector('[data-ccv-ref="node:B"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    const choice = root.querySelector<HTMLSelectElement>('select[aria-label="图表风格"]')!;
    choice.value = 'second'; choice.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(second.render).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    expect(root.querySelector('.ccv')?.getAttribute('data-renderer')).toBe('second');
    expect(root.querySelector<HTMLElement>('.ccv')?.style.getPropertyValue('--ccv-accent')).toBe('#bf4520');
    expect(root.querySelector('[data-ccv-ref="node:B"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由');
    expect(first.render).toHaveBeenCalledOnce();
  });

  it('rejects an empty or ambiguous style registry before mounting', () => {
    const root = setup(), app = createApp({ render: () => h('div') });
    const backend: DiagramRenderer = { id: 'same', label: 'Same', supports: () => true, render: vi.fn() };
    expect(() => app.use(clearcodeViewPlugin, { renderers: [] })).toThrow(/不能为空/);
    const duplicate = createApp({ render: () => h('div') });
    expect(() => duplicate.use(clearcodeViewPlugin, { renderers: [backend, backend] })).toThrow(/重复/);
    const missing = createApp({ render: () => h('div') });
    expect(() => missing.use(clearcodeViewPlugin, { renderers: [backend], renderer: { ...backend, id: 'missing' } })).toThrow(/不存在.*missing/);
    root.remove();
  });

  it('follows host appearance for every diagram without adding a second theme control', async () => {
    const root = setup(), dispose = vi.fn();
    let preferences!: DisplayPreferences;
    const backend: DiagramRenderer = { id: 'host', label: 'Host', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const app = createApp({ setup() {
      preferences = useDisplayPreferences();
      return () => h('div', [h(DiagramView, { model }), h(DiagramView, { model: { ...model, id: 'second' } })]);
    } });
    app.use(clearcodeViewPlugin, { renderers: [backend] }); app.mount(root); apps.push(app);
    await vi.waitFor(() => expect(backend.render).toHaveBeenCalledTimes(2));
    root.querySelector('[data-ccv-ref="node:B"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    preferences.followColorScheme('dark');
    await vi.waitFor(() => expect([...root.querySelectorAll('.ccv')].map(element => element.getAttribute('data-theme'))).toEqual(['blueprint', 'blueprint']));
    await vi.waitFor(() => expect(backend.render).toHaveBeenCalledTimes(4));
    expect(root.querySelector('[data-ccv-ref="node:B"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由');
    expect(root.querySelectorAll('select')).toHaveLength(0);
  });
  it('keeps selection and Chinese reading content when replacing a drawing, then disposes it on unmount', async () => {
    const root = setup(), dispose = vi.fn(), appearance = shallowRef(studioTheme);
    const backend: DiagramRenderer = { id: 'host', label: 'Host', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const app = createApp({ render: () => h(DiagramView, { model, renderer: backend, theme: appearance.value }) });
    app.mount(root); apps.push(app);
    await vi.waitFor(() => expect(root.querySelector('[data-ccv-ref="node:B"]')).not.toBeNull());
    root.querySelector('[data-ccv-ref="node:B"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(root.querySelector('.ccv-inspector h3')?.textContent).toBe('请求网关');
    appearance.value = blueprintTheme;
    await vi.waitFor(() => expect(backend.render).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
    expect(root.querySelector('[data-ccv-ref="node:B"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.ccv-inspector')?.textContent).toContain('负责接纳与路由');
    app.unmount(); apps.splice(apps.indexOf(app), 1);
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('does not mount a late result from a replaced renderer', async () => {
    const root = setup(), lateMount = vi.fn(), dispose = vi.fn();
    let resolveLate!: (result: RenderedScene) => void;
    const first: DiagramRenderer = { id: 'slow', label: 'Slow', supports: () => true, render: vi.fn(() => new Promise<RenderedScene>(resolve => { resolveLate = resolve; })) };
    const second: DiagramRenderer = { id: 'ready', label: 'Ready', supports: () => true, render: vi.fn(async diagram => scene(diagram, dispose)) };
    const backend = shallowRef(first);
    const app = createApp({ render: () => h(DiagramView, { model, renderer: backend.value }) });
    app.mount(root); apps.push(app);
    await vi.waitFor(() => expect(first.render).toHaveBeenCalledOnce());
    backend.value = second;
    await vi.waitFor(() => expect(root.querySelector('[data-ccv-ref="node:B"]')).not.toBeNull());
    resolveLate({ svg: '<svg viewBox="0 0 10 10"/>', mount: lateMount });
    await nextTick();
    expect(lateMount).not.toHaveBeenCalled();
    expect(root.querySelector('.ccv')?.getAttribute('data-renderer')).toBe('ready');
    expect(root.querySelector('[data-ccv-ref="node:B"]')).not.toBeNull();
  });
});
