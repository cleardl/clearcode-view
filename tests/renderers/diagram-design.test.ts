/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagram, type ParsedDiagram } from '../../src/core.js';
import { renderScene, diagramDesignRenderer } from '../../src/renderers.js';
import { studioTheme, blueprintTheme } from '../../src/themes.js';
import { renderMermaid } from '../../src/mermaid/render.js';
import { bindDiagram } from '../../src/mermaid/bind.js';
import { presentDiagramDesign } from '../../src/renderers/diagram-design-presentation.js';
import type { GraphMetadata } from '../../src/mermaid/model.js';

vi.mock('../../src/mermaid/render.js', () => ({ renderMermaid: vi.fn(async () => ({ svg: '<svg/>', metadata: { type: 'other', groups: [], elements: new Map() } })) }));
afterEach(() => vi.clearAllMocks());

describe('Diagram Design interactive renderer', () => {
  it('passes the complete Mermaid source and view state to native layout without changing the host theme', async () => {
    const source = 'sequenceDiagram\nparticipant A\nparticipant DB@{ "type": "database" }\nalt ready\nA->>+DB: query\nDB-->>-A: rows\nelse pending\nA-)DB: enqueue\nend';
    const model = createDiagram({ id: 'request', source });
    const parsed: ParsedDiagram = { input: model, nativeType: 'sequence', graph: { type: 'sequence', groups: [], elements: new Map() } };
    await renderScene(diagramDesignRenderer, parsed, { id: 'scene', theme: studioTheme, collapsed: { region: true } });
    const [input, id, collapsed, appearance] = vi.mocked(renderMermaid).mock.calls[0];
    expect(input.source).toBe(source);
    expect(id).toBe('scene');
    expect(collapsed).toEqual({ region: true });
    expect(appearance.mermaid).toMatchObject({ look: 'classic', theme: 'base' });
    expect(appearance.variables['--ccv-accent']).toBe('#bf4520');
    expect(studioTheme.mermaid.look).toBe('neo');
    expect(studioTheme.variables['--ccv-accent']).toBe('#2563c7');
  });

  it('derives both reading surfaces from an explicit scheme and preserves the theme identity', () => {
    const light = diagramDesignRenderer.resolveTheme!(studioTheme), dark = diagramDesignRenderer.resolveTheme!(blueprintTheme);
    expect(light.id).toBe('studio');
    expect(dark.id).toBe('blueprint');
    expect(light.variables['--ccv-bg']).toBe('#f5f5f5');
    expect(dark.variables['--ccv-bg']).toBe('#2d3142');
    expect(dark.variables['--ccv-accent']).toBe('#f08a59');
    expect(dark.mermaid.themeVariables.darkMode).toBe(true);
  });

  it('preserves open and filled arrow geometry while giving each relationship an independent highlight target', () => {
    const container = document.createElement('div');
    container.innerHTML = '<svg id="design"><defs><marker id="filled"><path class="arrowhead" d="M0 0L10 5L0 10Z"/></marker><marker id="open"><path d="M0 0L10 5L0 10" style="fill:none"/></marker></defs><line data-et="message" data-id="i0" class="messageLine0" marker-end="url(#filled)"/><line data-et="message" data-id="i1" class="messageLine1" marker-end="url(#filled)" style="stroke-dasharray:3,3"/><line data-et="message" data-id="i2" class="messageLine1" marker-end="url(#open)"/></svg>';
    const svg = container.querySelector('svg')!;
    const metadata: GraphMetadata = { type: 'sequence', groups: [], elements: new Map([
      ['message:call', { ref: 'message:call', dataId: 'i0', label: 'call', parents: [] }],
      ['message:return', { ref: 'message:return', dataId: 'i1', label: 'return', parents: [] }],
      ['message:async', { ref: 'message:async', dataId: 'i2', label: 'async', parents: [] }],
    ]) };
    const bindings = bindDiagram(svg, metadata, {});
    const legend = presentDiagramDesign(svg, metadata, bindings);
    const first = svg.querySelector('[data-id="i0"]')!, second = svg.querySelector('[data-id="i1"]')!;
    expect(first.getAttribute('marker-end')).not.toBe(second.getAttribute('marker-end'));
    expect(svg.querySelector('[data-ccv-design-arrow="open"]')?.getAttribute('d')).toBe('M0 0L10 5L0 10');
    expect(svg.querySelector('[data-ccv-design-arrow="filled"]')?.getAttribute('d')).toBe('M0 0L10 5L0 10Z');
    expect(svg.querySelector('[data-ccv-design-arrow]')?.getAttribute('tabindex')).toBeNull();
    expect(svg.querySelector('#filled path')?.hasAttribute('data-ccv-ref')).toBe(false);
    expect(svg.querySelector('[data-id="i1"]')?.getAttribute('style')).toContain('stroke-dasharray:3,3');
    expect(bindings.get('message:call')).toHaveLength(2);
    expect(bindings.get('message:return')).toHaveLength(2);
    expect(legend.map(entry => entry.line)).toEqual(['solid', 'dashed']);
  });

  it('keeps the icon and label gap clickable without drawing an extra participant box', () => {
    const container = document.createElement('div');
    container.innerHTML = '<svg><g data-et="participant" data-id="DB"><path d="M0 0H20V20H0Z"/><text x="10" y="50">Database</text></g></svg>';
    const svg = container.querySelector('svg')!, participant = svg.querySelector('g')!;
    Object.defineProperty(participant, 'getBBox', { value: () => new DOMRect(0, 0, 40, 60) });
    const metadata: GraphMetadata = { type: 'sequence', groups: [], elements: new Map([
      ['participant:DB', { ref: 'participant:DB', dataId: 'DB', label: 'Database', parents: [] }],
    ]) };
    presentDiagramDesign(svg, metadata, bindDiagram(svg, metadata, {}));
    const target = participant.querySelector<SVGElement>('[data-ccv-hit]')!;
    expect(target.getAttribute('height')).toBe('60');
    expect(target.style.getPropertyPriority('fill')).toBe('important');
    expect(target.style.fill).toBe('transparent');
    expect(target.style.pointerEvents).toBe('all');
    expect(target.closest('[data-ccv-ref]')?.getAttribute('data-ccv-ref')).toBe('participant:DB');
    expect(target.hasAttribute('tabindex')).toBe(false);
  });
});
