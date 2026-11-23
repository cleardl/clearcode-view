/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import mermaid from 'mermaid';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import { sequenceMetadata } from '../../src/mermaid/adapters/sequence.js';
import { flowchartMetadata, flowchartView } from '../../src/mermaid/adapters/flowchart.js';
import { visibleReference } from '../../src/mermaid/model.js';
import { blockMetadata } from '../../src/mermaid/adapters/block.js';
import { compileDocument, type DiagramModel } from '../../src/index.js';

beforeAll(() => { mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }); });
function model(source: string): DiagramModel {
  return { id: 'test', source, type: 'sequence', details: {}, links: {}, sections: {}, steps: [], location: { file: 'sequence.md', line: 1 } };
}

describe('native Mermaid semantic mapping', () => {
  // The native block parser loads its layout dependencies on the first call.
  it('keeps twelve components and all eleven routes in four static layers without playback', async () => {
    const source = readFileSync('examples/compare/tool-workflow.md', 'utf8');
    const graph = compileDocument(source).diagrams[0];
    const native = await mermaid.mermaidAPI.getDiagramFromText(graph.source);
    const metadata = blockMetadata(native.db as BlockDB, 'layers');
    expect(graph.type).toBe('block');
    expect(graph.steps).toEqual([]);
    expect(graph.overview).toBe('#layers');
    expect([...metadata.elements.values()].filter(item => item.classes?.includes('ccv-swimlane')).map(item => item.label)).toEqual(['User Interface', 'Agent Runtime', 'Policy & Recovery', 'Tool Execution & Evidence']);
    expect([...metadata.elements.values()].filter(item => item.ref.startsWith('node:') && !item.classes?.includes('ccv-phase'))).toHaveLength(12);
    expect(metadata.elements.get('node:chat')?.parents).toEqual(['ui']);
    expect(metadata.elements.get('node:planner')?.domId).toBe('layers-planner');
    const edges = (native.db as BlockDB).getEdges();
    expect(edges.map(edge => `${edge.start} → ${edge.end}`)).toEqual([
      'user → chat', 'chat → planner', 'planner → router', 'router → approval',
      'approval → tool', 'approval → blocked', 'blocked → retry', 'tool → external',
      'external → final', 'external → trace', 'store → trace',
    ]);
    expect(edges.filter(edge => edge.thickness === 'thick')).toHaveLength(3);
    expect(edges.filter(edge => edge.pattern === 'dotted')).toHaveLength(5);
    expect(metadata.elements.get('edge:1-external-final')).toMatchObject({ from: 'external', to: 'final' });
    expect(Object.keys(graph.details).filter(ref => ref.startsWith('edge:'))).toHaveLength(11);
  }, 15000);
  it('maps labelled messages across repeated text and control structures', async () => {
    const source = 'sequenceDiagram\nparticipant A\nparticipant B\nA->>B: same\n%% ccv:message request\nA->>B: same\nalt accepted\n%% ccv:message reply\nB-->>A: result\nend';
    const native = await mermaid.mermaidAPI.getDiagramFromText(source);
    const metadata = await sequenceMetadata(mermaid, model(source), native.db as SequenceDB);
    expect(metadata.elements.get('message:request')?.dataId).toBe('i1');
    expect(metadata.elements.get('message:reply')?.dataId).toBe('i3');
    expect([...metadata.elements.keys()].filter(key => key.startsWith('participant:'))).toEqual(['participant:A', 'participant:B']);
  });

  it('rejects annotations attached to control statements', async () => {
    const source = 'sequenceDiagram\nparticipant A\nparticipant B\n%% ccv:message wrong\nloop repeat\nA->>B: hello\nend';
    const native = await mermaid.mermaidAPI.getDiagramFromText(source);
    await expect(sequenceMetadata(mermaid, model(source), native.db as SequenceDB)).rejects.toThrow(/非消息/);
  });

  it('rejects duplicate authored message identifiers', async () => {
    const source = 'sequenceDiagram\n%% ccv:message request\nA->>B: first\n%% ccv:message request\nA->>B: second';
    const native = await mermaid.mermaidAPI.getDiagramFromText(source);
    await expect(sequenceMetadata(mermaid, model(source), native.db as SequenceDB)).rejects.toThrow(/重复消息/);
  });

  it('keeps selection inside collapsed groups without expanding their members', async () => {
    const source = 'flowchart LR\nsubgraph host[Host]\nA[Alpha] send@--> B[Beta]\nend';
    const native = await mermaid.mermaidAPI.getDiagramFromText(source);
    const metadata = flowchartMetadata(native.db as FlowDB);
    expect(metadata.elements.has('edge:send')).toBe(true);
    expect(visibleReference('node:A', metadata, { host: true })).toBe('group:host');
    expect(visibleReference('edge:send', metadata, { host: true })).toBe('group:host');
    const view = flowchartView(source, metadata.groups, { host: true });
    const folded = await mermaid.mermaidAPI.getDiagramFromText(view);
    expect((folded.db as FlowDB).getSubGraphs()[0].metadata?.view).toBe('collapsed');
  });
});
