/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createDiagram, validateGraphReferences } from '../../src/core.js';
import { parseMermaid } from '../../src/mermaid.js';
import { renderScene, validateMountedDiagram, bindSemanticElements, type DiagramRenderer, type MountedDiagram } from '../../src/renderers.js';
import { studioTheme } from '../../src/themes.js';

describe('Mermaid content and renderer separation', () => {
  // The first parse also loads Mermaid and its diagram module in a cold worker.
  it('passes lossless Mermaid and semantic IDs to a backend without reading HTML or DOM IDs', async () => {
    const model = createDiagram({ id: 'request', source: 'flowchart LR\nA[Client] submit@--> B[Gateway]', overview: '#intro', sections: { '#intro': { ref: '#intro', title: 'Read', html: '<p>Document-only content</p>' } } });
    const parsed = await parseMermaid(model);
    const render = vi.fn<DiagramRenderer['render']>(async () => ({ svg: '<svg/>', mount: () => ({ bindings: new Map(), legend: [] }) }));
    const renderer: DiagramRenderer = { id: 'independent', label: 'Independent', supports: () => true, render };
    await renderScene(renderer, parsed, { id: 'output', theme: studioTheme });
    const received = render.mock.calls[0][0];
    expect(received.input.source).toBe(model.source);
    expect(received.input).not.toHaveProperty('sections');
    expect(received.input).not.toHaveProperty('overview');
    expect(received.graph.elements.get('edge:submit')).toMatchObject({ from: 'A', to: 'B' });
    expect(received.graph.elements.get('node:A')).not.toHaveProperty('dataId');
    expect(received.graph.elements.get('node:A')).not.toHaveProperty('domId');
  }, 15000);

  it('keeps sequence control structures in the source and resolves named messages independently of Markdown', async () => {
    const source = 'sequenceDiagram\nparticipant A\nparticipant B\nalt accepted\n%% ccv:message reply\nA-->>B: result\nelse denied\nA-->>B: stop\nend';
    const parsed = await parseMermaid(createDiagram({ id: 'conversation', source }));
    expect(parsed.input.source).toBe(source);
    expect(parsed.graph.elements.get('message:reply')).toMatchObject({ from: 'A', to: 'B', label: 'result' });
    expect(parsed.nativeType).toBe('sequence');
  });

  it('preserves native diagram syntax outside the semantic enhancement families', async () => {
    const source = 'erDiagram\nCUSTOMER ||--o{ ORDER : places\nCUSTOMER {\nuuid id PK\n}\nORDER {\nuuid customer_id FK\n}';
    const parsed = await parseMermaid(createDiagram({ id: 'schema', source }));
    expect(parsed.nativeType).toBe('er');
    expect(parsed.input.source).toBe(source);
    expect(parsed.graph.type).toBe('other');
  });

  it('serializes concurrent parses so diagrams do not share actor state', async () => {
    const first = createDiagram({ id: 'one', source: 'sequenceDiagram\nparticipant A as First\nA->>B: one' });
    const second = createDiagram({ id: 'two', source: 'sequenceDiagram\nparticipant A as Second\nA->>C: two' });
    const [a, b] = await Promise.all([parseMermaid(first), parseMermaid(second)]);
    expect(a.graph.elements.get('participant:A')?.label).toBe('First');
    expect(b.graph.elements.get('participant:A')?.label).toBe('Second');
    expect(a.graph.elements.has('participant:C')).toBe(false);
    expect(b.graph.elements.has('participant:B')).toBe(false);
  });

  it('rejects unsupported backend content before invoking its render method', async () => {
    const parsed = await parseMermaid(createDiagram({ id: 'flow', source: 'flowchart LR\nA-->B' }));
    const renderer: DiagramRenderer = { id: 'sequence-only', label: 'Sequence only', supports: value => value.graph.type === 'sequence', render: vi.fn() };
    await expect(renderScene(renderer, parsed, { id: 'test', theme: studioTheme })).rejects.toThrow(/sequence-only.*不支持.*flowchart/);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('keeps the original source location when a backend fails', async () => {
    const parsed = await parseMermaid(createDiagram({ id: 'flow', source: 'flowchart LR\nA-->B', location: { file: 'request.mmd', line: 9, diagram: 'flow' } }));
    const renderer: DiagramRenderer = { id: 'failing', label: 'Failing', supports: () => true, render: async () => { throw new Error('Layout failed'); } };
    await expect(renderScene(renderer, parsed, { id: 'test', theme: studioTheme })).rejects.toThrow(/request.mmd:9.*Layout failed/);
  });

  it('reports missing source references before drawing or mounting', async () => {
    const model = createDiagram({ id: 'flow', source: 'flowchart LR\nA-->B', details: { 'node:missing': '#detail' }, sections: { '#detail': { ref: '#detail', title: 'Detail', html: '' } } });
    const parsed = await parseMermaid(model);
    expect(() => validateGraphReferences(model, parsed.graph)).toThrow(/图元素不存在.*node:missing/);
  });

  it('rejects omitted targets while accepting an explicitly collapsed visible ancestor', async () => {
    const parsed = await parseMermaid(createDiagram({ id: 'group', source: 'flowchart LR\nsubgraph host[Host]\nA[Alpha] send@--> B[Beta]\nend' }));
    const container = document.createElement('div');
    container.innerHTML = '<svg><g data-ccv-ref="group:host"><text data-ccv-ref="group:host" data-ccv-passive="true">Host</text></g></svg>';
    const svg = container.querySelector('svg')!;
    Object.defineProperty(svg.querySelector('g'), 'getBBox', { value: () => new DOMRect(0, 0, 100, 50) });
    const bindings = bindSemanticElements(svg, parsed.graph, { host: true }, parsed.input.location);
    const mounted: MountedDiagram = { bindings, legend: [] };
    expect(() => validateMountedDiagram(parsed, mounted, { host: true })).not.toThrow();
    expect(() => validateMountedDiagram(parsed, mounted, { host: false })).toThrow(/缺少图元素.*node:A/);
    expect(svg.querySelector('[data-ccv-toggle]')?.getAttribute('aria-label')).toBe('展开 Host');
    expect(svg.querySelector('text[data-ccv-ref]')?.getAttribute('tabindex')).toBeNull();
  });
});
