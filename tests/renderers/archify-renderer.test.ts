/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDiagram } from '../../src/core.js';
import { compileDocument } from '../../src/protocol/parse.js';
import { parseMermaid } from '../../src/mermaid/parse.js';
import { diagramAnnotations } from '../../src/mermaid/annotations.js';
import { renderScene, archifyRenderer, createArchifyRenderer } from '../../src/renderers.js';
import { archifyProjection } from '../../src/renderers/archify/projection.js';
import { scopeArchifySvg } from '../../src/renderers/archify/bind.js';
import { studioTheme, blueprintTheme } from '../../src/themes.js';

describe('official Archify drawing with Mermaid input', () => {
  it.each([
    ['architecture', 'flowchart TB\nsubgraph host[Host]\nA[Client] send@-.-> B[Worker]\nend'],
    ['architecture', 'block\ncolumns 2\nA["API"]\nB[("Database")]\nA-->B'],
    ['sequence', 'sequenceDiagram\nparticipant A\nparticipant B\nalt ready\nA->>+B: work\nB-->>-A: result\nelse pending\nA-)B: queue\nend'],
    ['erd', 'erDiagram\nORDER {\nuuid id PK\nuuid owner FK\n}'],
    ['class', 'classDiagram\nclass Gateway {\n+dispatch()\n}\nGateway o-- Worker'],
    ['lifecycle', 'stateDiagram-v2\n[*]-->Idle\nIdle-->Active: run\nActive-->Idle: stop'],
  ])('renders native input with the official %s engine', async (kind, source) => {
    const model = createDiagram({ id: 'rich', source }), parsed = await parseMermaid(model);
    const result = await renderScene(archifyRenderer, parsed, { id: 'scene', theme: studioTheme, collapsed: {} });
    expect(result.svg).toContain('Archify');
    expect((await archifyProjection(parsed)).document.diagram_type).toBe(kind);
    expect(parsed.input.source).toBe(source);
  });

  it('renders changed labels and relationships from Mermaid without an example fixture or HTML', async () => {
    const source = 'flowchart LR\nA[Gateway] send@--> B[Worker]';
    const first = await parseMermaid(createDiagram({ id: 'one', source }));
    const changed = await parseMermaid(createDiagram({ id: 'two', source: source.replace('Worker', 'New executor').replace('-->', '-.->').replace('B[', 'C[') }));
    const a = await renderScene(archifyRenderer, first, { id: 'a', theme: studioTheme, collapsed: {} });
    const b = await renderScene(archifyRenderer, changed, { id: 'b', theme: studioTheme, collapsed: {} });
    expect(a.svg).toContain('Worker'); expect(b.svg).not.toContain('Worker');
    expect(b.svg).toContain('New executor'); expect(b.svg).toContain('data-edge-to="C"');
    const projected = await archifyProjection(changed);
    expect(projected.document.connections).toMatchObject([{ from: 'A', to: 'C', variant: 'dashed' }]);
  });

  it('keeps complete Chinese decision labels when the global rich style is used for a plain Mermaid diagram', async () => {
    const model = compileDocument(readFileSync('examples/bug-analysis.md', 'utf8')).diagrams[0];
    const result = await renderScene(archifyRenderer, await parseMermaid(model), { id: 'chinese', theme: studioTheme, collapsed: {} });
    expect(result.svg).toContain('事件游标大于已应用游标？');
    expect(result.svg).toContain('检查重复订阅与投影拥有者');
  });

  it('maps a folded architecture to its explicit aggregate without losing the reading identity', async () => {
    const parsed = await parseMermaid(createDiagram({ id: 'fold', source: 'flowchart LR\nsubgraph host[Services]\nA[Alpha] send@--> B[Beta]\nend\nB reply@--> C[Client]' }));
    const projected = await archifyProjection(parsed, { host: true });
    expect(projected.document.components).toMatchObject([{ id: 'C' }, { id: 'host', label: 'Services' }]);
    expect(projected.document.connections).toMatchObject([{ from: 'host', to: 'C' }]);
    expect(projected.nodeRefs.get('host')).toBe('group:host');
    expect(projected.edgeRefs.get('reply')).toBe('edge:reply');
  });

  it.each([
    'sequenceDiagram\nparticipant A as Client\nparticipant B as Service\n%% ccv:message prepare\nA->>A: 校验输入\nNote right of A: 保留原始说明\nA->>B: work\n%% ccv:message done\nB-->>B: 清理状态',
    'sequenceDiagram\nparticipant A as Worker\n%% ccv:message prepare\nA->>A: prepare\n%% ccv:message done\nA-->>A: done',
  ])('renders self-messages without inventing actors or losing message identities', async source => {
    const input = createDiagram({ id: 'self-messages', source });
    const parsed = await parseMermaid(input), projected = await archifyProjection(parsed);
    expect(projected.edgeRefs.get('prepare')).toBe('message:prepare');
    expect(projected.edgeRefs.get('done')).toBe('message:done');
    const result = await renderScene(archifyRenderer, parsed, { id: 'self-scene', theme: studioTheme, collapsed: {} });
    const host = document.createElement('div'); host.innerHTML = result.svg;
    for (const id of ['prepare', 'done']) {
      const path = host.querySelector(`[data-edge-id="${id}"] path[data-composition-points]`);
      expect(path, id).not.toBeNull();
      expect(path!.getAttribute('d')!.match(/L /g)).toHaveLength(3);
    }
    expect(result.svg).not.toContain('ccvAnnotation');
    expect(input.source).toBe(source);
  });

  it('keeps the host theme identity and includes the complete official palette', () => {
    const light = archifyRenderer.resolveTheme!(studioTheme), dark = archifyRenderer.resolveTheme!(blueprintTheme);
    expect(light.id).toBe('studio'); expect(dark.id).toBe('blueprint');
    expect(light.variables['--ccv-frontend']).toBe('#0891b2');
    expect(dark.variables['--ccv-frontend']).toBe('#22d3ee');
    expect(light.variables['--security-stroke']).toBe('#e11d48');
    expect(dark.variables['--security-stroke']).toBe('#fb7185');
    expect(blueprintTheme.variables['--ccv-canvas']).toBe('#101c2e');
  });

  it('chooses host-owned presets by diagram ID without modifying the Mermaid input', async () => {
    const source = 'flowchart LR\nA[Client] send@--> B[Gateway]', input = createDiagram({ id: 'delivery', source });
    const backend = createArchifyRenderer({ diagrams: { delivery: { preset: 'signal-flow' } } });
    const result = await renderScene(backend, await parseMermaid(input), { id: 'configured', theme: studioTheme, collapsed: {} });
    expect(result.svg).toContain('data-preset="signal-flow"');
    expect(input.source).toBe(source); expect(input.source).not.toContain('signal-flow');
  });

  it('namespaces markers and accessible names for two SVGs while retaining semantic IDs', () => {
    const host = document.createElement('div');
    host.innerHTML = '<svg aria-labelledby="title"><title id="title">Title</title><defs><marker id="arrow"><path/></marker></defs><g id="node-A" data-node-id="A"><path marker-end="url(#arrow)"/><use href="#node-A"/></g></svg>';
    const first = host.querySelector('svg')!, second = first.cloneNode(true) as SVGSVGElement;
    scopeArchifySvg(first, 'first'); scopeArchifySvg(second, 'second');
    expect(first.getAttribute('aria-labelledby')).toBe('first-title');
    expect(first.querySelector('[marker-end]')!.getAttribute('marker-end')).toBe('url(#first-arrow)');
    expect(second.querySelector('use')!.getAttribute('href')).toBe('#second-node-A');
    expect(second.querySelector('[data-node-id]')!.getAttribute('data-node-id')).toBe('A');
    expect([...first.querySelectorAll('[id]')].some(element => second.querySelector(`[id="${element.id}"]`))).toBe(false);
  });

  it('keeps the reference fixtures pinned to their recorded upstream hashes', () => {
    const catalog = JSON.parse(readFileSync('examples/public/reference/archify/source.json', 'utf8')) as { files: { sourceJson?: string; sourceJsonSha256?: string }[]; cases: { sources: { file: string }[] }[] };
    for (const entry of catalog.cases) for (const source of entry.sources) {
      const recorded = catalog.files.find(file => file.sourceJson === 'archify/examples/' + source.file);
      expect(recorded?.sourceJsonSha256, source.file).toBeDefined();
      expect(createHash('sha256').update(readFileSync('tests/fixtures/archify/' + source.file)).digest('hex'), source.file).toBe(recorded!.sourceJsonSha256);
    }
  });
});

describe('additive Mermaid semantic comments', () => {
  it.each([
    ['%% ccv:node A {"pos":[1,2]}', /Unrecognized key/],
    ['%% ccv:node A {"label":"duplicate"}', /Unrecognized key/],
    ['%% ccv:node A {"main":true}\n%% ccv:node A {}', /重复/],
    ['%% ccv:diagram wrong {"kind":"architecture"}', /不接受元素 ID/],
    ['%% ccv:node A {invalid}', /JSON|property/i],
    ['%% ccv:group A', /无效图语义声明/],
  ])('rejects ambiguous or presentation-only declarations: %s', (comment, error) => {
    expect(() => diagramAnnotations(createDiagram({ id: 'bad', source: 'flowchart LR\nA[Alpha]\n' + comment }))).toThrow(error);
  });

  it('rejects an annotation referring to a nonexistent native element with source context', async () => {
    const parsed = await parseMermaid(createDiagram({ id: 'bad-ref', source: 'flowchart LR\nA[Alpha]\n%% ccv:node missing {"brand":"github"}' }));
    await expect(renderScene(archifyRenderer, parsed, { id: 'bad', theme: studioTheme, collapsed: {} })).rejects.toThrow(/diagram.mmd.*missing/);
  });

  it('keeps official workflow phases and exception groups in additive comments', async () => {
    const model = compileDocument(readFileSync('examples/compare/release-delivery.md', 'utf8')).diagrams[0];
    const annotations = diagramAnnotations(model);
    expect(annotations.nodes.get('phase_verify')?.variant).toBe('emphasis');
    expect([...annotations.groups.values()].some(group => group.variant === 'exception')).toBe(true);
    expect(model.source).not.toMatch(/"(?:pos|size|via|viewBox|fromSide|toSide)"/);
  });
});
