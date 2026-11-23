/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import { blockMetadata } from '../../src/mermaid/adapters/block.js';
import { flowchartMetadata } from '../../src/mermaid/adapters/flowchart.js';
import { sequenceMetadata } from '../../src/mermaid/adapters/sequence.js';
import { bindDiagram } from '../../src/mermaid/bind.js';
import { elementRole, presentDiagram } from '../../src/renderers/custom-presentation.js';
import { compileDocument } from '../../src/protocol/parse.js';

beforeAll(() => { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }); });

describe('theme presentation and native Mermaid semantics', () => {
  it('binds mirrored databases with identical labels and a queue to their own lifelines', async () => {
    const source = 'sequenceDiagram\nparticipant Cache@{ "type": "database" } as Store\nparticipant Primary@{ "type": "database" } as Store\nparticipant Trace@{ "type": "queue" }\nCache->>Primary: read';
    const model = compileDocument('```mermaid\n' + source + '\n```').diagrams[0];
    const native = await mermaid.mermaidAPI.getDiagramFromText(source);
    const metadata = await sequenceMetadata(mermaid, model, native.db as SequenceDB);
    const container = document.createElement('div');
    container.innerHTML = '<svg><line data-et="life-line" data-id="Cache" x1="150"/><line data-et="life-line" data-id="Primary" x1="350"/><line data-et="life-line" data-id="Trace" x1="550"/><g data-et="participant" data-id="Cache"/><g data-et="participant" data-id="Primary"/><g data-et="participant" data-id="Trace"/><g id="primary-footer"><g class="actor actor-bottom"><path/></g><text>Store</text></g><g id="cache-footer"><g class="actor actor-bottom"><path/></g><text>Store</text></g><g id="trace-footer" class="actor actor-bottom"><g><path/></g><text>Trace</text></g></svg>';
    const svg = container.querySelector('svg')!;
    Object.defineProperty(svg.querySelector('#primary-footer'), 'getBBox', { value: () => new DOMRect(300, 600, 100, 70) });
    Object.defineProperty(svg.querySelector('#cache-footer'), 'getBBox', { value: () => new DOMRect(100, 600, 100, 70) });
    Object.defineProperty(svg.querySelector('#trace-footer'), 'getBBox', { value: () => new DOMRect(500, 600, 100, 70) });
    const bound = bindDiagram(svg, metadata, {});
    presentDiagram(svg, metadata, bound);
    expect(bound.get('participant:Cache')).toHaveLength(2);
    expect(bound.get('participant:Primary')).toHaveLength(2);
    expect(bound.get('participant:Trace')).toHaveLength(2);
    expect(svg.querySelector('#cache-footer')?.getAttribute('data-ccv-ref')).toBe('participant:Cache');
    expect(svg.querySelector('#primary-footer')?.getAttribute('data-ccv-ref')).toBe('participant:Primary');
    expect(svg.querySelector('#cache-footer')?.getAttribute('data-ccv-role')).toBe('database');
    expect(svg.querySelector('#trace-footer')?.getAttribute('data-ccv-ref')).toBe('participant:Trace');
    expect(svg.hasAttribute('data-et')).toBe(false);
  });

  it('binds a named footer box and its label as the same participant as the header', () => {
    const container = document.createElement('div');
    container.innerHTML = '<svg><g data-et="participant" data-id="API"><rect/></g><g id="footer"><rect class="actor actor-bottom" name="API"/><text>API</text></g></svg>';
    const svg = container.querySelector('svg')!;
    const metadata = { type: 'sequence' as const, groups: [], elements: new Map([
      ['participant:API' as const, { ref: 'participant:API' as const, dataId: 'API', label: 'API', role: 'backend', parents: [] }],
    ]) };
    const bound = bindDiagram(svg, metadata, {});
    presentDiagram(svg, metadata, bound);
    expect(bound.get('participant:API')).toHaveLength(2);
    expect(svg.querySelector('#footer')?.getAttribute('data-ccv-ref')).toBe('participant:API');
    expect(svg.querySelector('#footer')?.getAttribute('data-ccv-role')).toBe('backend');
  });
  // The native block parser loads its layout dependencies on the first call.
  it('colors block connections by their receiver while keeping the native arrow and dash styles', async () => {
    const native = await mermaid.mermaidAPI.getDiagramFromText('block\ncolumns 2\nA["API"]\nB["Log"]\nA -.-> B\nclass A ccv-backend\nclass B ccv-database');
    const metadata = blockMetadata(native.db as BlockDB, 'block-test');
    const container = document.createElement('div');
    container.innerHTML = '<svg id="block-test"><defs><marker id="arrow"><path d="M0 0L5 3L0 6z" /></marker></defs><g id="block-test-A" class="node"/><g id="block-test-B" class="node"/><path id="block-test-block-test-1-A-B" class="flowchart-link edge-pattern-dotted" marker-end="url(#arrow)" style="stroke-dasharray:3,3" /></svg>';
    const svg = container.querySelector('svg')!;
    presentDiagram(svg, metadata, bindDiagram(svg, metadata, {}));
    const line = svg.querySelector<SVGElement>('path.flowchart-link')!;
    expect(line.getAttribute('data-ccv-ref')).toBe('edge:1-A-B');
    expect(line.getAttribute('data-ccv-role')).toBe('database');
    expect(line.style.strokeDasharray).toBe('3,3');
    expect(line.getAttribute('marker-end')).toBe('url(#block-test-ccv-arrow-0)');
  }, 15000);
  it('retains native node roles, storage shapes and relationship classes', async () => {
    const graph = await mermaid.mermaidAPI.getDiagramFromText('flowchart LR\nA[API]:::ccv-backend send@-.-> B[(Store)]:::ccv-database\nclass send ccv-messagebus');
    const metadata = flowchartMetadata(graph.db as FlowDB);
    expect(elementRole(metadata.elements.get('node:A')!)).toBe('backend');
    expect(elementRole(metadata.elements.get('node:B')!)).toBe('database');
    expect(elementRole(metadata.elements.get('edge:send')!)).toBe('messagebus');
    expect(metadata.elements.get('node:B')?.shape).toBe('cylinder');
  });

  it('keeps participant properties and message endpoints through activations', async () => {
    const source = 'sequenceDiagram\nparticipant API\nparticipant DB@{ "type": "database" }\nproperties API: {"ccvRole":"backend"}\nactivate API\n%% ccv:message query\nAPI->>DB: query\ndeactivate API';
    const model = compileDocument('```mermaid\n' + source + '\n```', { file: 'theme.md' }).diagrams[0];
    const graph = await mermaid.mermaidAPI.getDiagramFromText(source);
    const metadata = await sequenceMetadata(mermaid, model, graph.db as SequenceDB);
    expect(elementRole(metadata.elements.get('participant:API')!)).toBe('backend');
    expect(elementRole(metadata.elements.get('participant:DB')!)).toBe('database');
    expect(metadata.elements.get('message:query')).toMatchObject({ from: 'API', to: 'DB' });
    expect(model).not.toHaveProperty('theme');
  });

  it('colors each message arrow locally while retaining native line styles', () => {
    const container = document.createElement('div');
    container.innerHTML = '<svg id="one"><defs><marker id="one-arrow"><path d="M0 0L5 3L0 6z" /></marker></defs><g data-et="participant" data-id="API"><rect /></g><g data-et="participant" data-id="DB"><rect /></g><line data-et="life-line" data-id="API" x1="10" /><text class="messageText">query</text><line data-et="message" data-id="i0" data-from="API" data-to="DB" class="messageLine1" marker-end="url(#one-arrow)" style="stroke-dasharray:3,3" /></svg>';
    const svg = container.querySelector('svg')!;
    const metadata = { type: 'sequence' as const, groups: [], elements: new Map([
      ['participant:API' as const, { ref: 'participant:API' as const, dataId: 'API', label: 'API', role: 'backend', parents: [] }],
      ['participant:DB' as const, { ref: 'participant:DB' as const, dataId: 'DB', label: 'DB', role: 'database', parents: [] }],
      ['message:query' as const, { ref: 'message:query' as const, dataId: 'i0', label: 'query', parents: [] }],
    ]) };
    const bound = bindDiagram(svg, metadata, {});
    const legend = presentDiagram(svg, metadata, bound);
    const line = svg.querySelector<SVGElement>('[data-et="message"]')!;
    expect(line.getAttribute('marker-end')).toBe('url(#one-ccv-arrow-0)');
    expect(svg.querySelector('#one-ccv-arrow-0 path')?.getAttribute('style')).toContain('--ccv-arrow-color');
    expect(svg.querySelector('#one-arrow path')?.getAttribute('style')).toBeNull();
    expect(line.style.strokeDasharray).toBe('3,3');
    expect(line.getAttribute('data-ccv-role')).toBe('backend');
    expect(svg.querySelector('.messageText')?.getAttribute('data-ccv-ref')).toBe('message:query');
    expect(legend.map(entry => entry.label)).toEqual(['API', 'DB', '虚线消息']);
  });
});
