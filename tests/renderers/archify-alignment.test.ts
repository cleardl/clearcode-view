/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { compileDocument } from '../../src/protocol/parse.js';
import { parseMermaid } from '../../src/mermaid/parse.js';
import { archifyProjection } from '../../src/renderers/archify/projection.js';
import { drawArchify } from '../../src/renderers/archify/draw.js';
import type { ArchifyDocument, ArchifyNode } from '../../src/renderers/archify/model.js';
import type { ArchifyRelation } from '../../src/renderers/archify/model.js';
import { validateGraphReferences } from '../../src/core/validate.js';
import { archifyExamplePresentation } from '../../examples/.vitepress/archify-presentation.js';

interface Entry { slug: string; sources: { file: string; type: string }[] }
const catalog = JSON.parse(readFileSync('examples/public/reference/archify/source.json', 'utf8')) as { cases: Entry[] };
const nodeKey: Record<string, string> = { architecture: 'components', workflow: 'nodes', sequence: 'participants', dataflow: 'nodes', lifecycle: 'states', erd: 'entities', class: 'types', tree: 'nodes', timeline: 'events', waterfall: 'spans' };
const edgeKey: Record<string, string> = { architecture: 'connections', workflow: 'edges', sequence: 'messages', dataflow: 'flows', lifecycle: 'transitions', erd: 'relationships', class: 'relationships' };
const name = (node: ArchifyNode) => String(node.label || node.title || node.name).trim();
const corresponding = (nodes: ArchifyNode[], node: ArchifyNode): ArchifyNode | undefined => nodes.find(value => value.id === node.id || value.id === 'n_' + node.id) || nodes.find(value => name(value) === name(node));
const records = (document: ArchifyDocument, key: string): ArchifyNode[] => document[key] as ArchifyNode[] || [];
const semanticKeys = ['sublabel', 'tag', 'brand', 'detail', 'type', 'kind', 'step', 'service'] as const;

function compareSemantics(original: ArchifyDocument, actual: ArchifyDocument, type: string): void {
  const expectedNodes = records(original, nodeKey[type]), actualNodes = records(actual, nodeKey[type]);
  const ids = new Map(expectedNodes.map(node => [node.id, corresponding(actualNodes, node)!.id]));
  expect(actual.meta.title).toBe(original.meta.title);
  for (const node of expectedNodes) {
    const match = actualNodes.find(value => value.id === ids.get(node.id))!;
    for (const key of semanticKeys) if (node[key] !== undefined) expect(match[key], `${name(node)} ${key}`).toEqual(node[key]);
    if (node.parent) expect(match.parent, name(node) + ' parent').toBe(ids.get(String(node.parent)));
    if (type === 'waterfall') { expect(Number(match.start)).toBeCloseTo(Number(node.start), 9); expect(Number(match.end)).toBeCloseTo(Number(node.end ?? Number(node.start) + Number(node.duration)), 9); }
    if (type === 'timeline') expect(Date.parse(String(match.at))).toBe(Date.parse(String(node.at)));
    if (type === 'erd') expect(match.attributes).toEqual(node.attributes);
  }
  if (edgeKey[type]) {
    const originalEdges = original[edgeKey[type]] as ArchifyRelation[], actualEdges = actual[edgeKey[type]] as ArchifyRelation[];
    for (const edge of originalEdges) {
      const match = actualEdges.find(value => value.from === ids.get(edge.from) && value.to === ids.get(edge.to) && (value.label || '').trim() === (edge.label || '').trim());
      expect(match, `${edge.from} → ${edge.to}: ${edge.label || ''}`).toBeDefined();
      expect(match!.variant || 'default', edge.label || edge.from + ' variant').toBe(edge.variant || 'default');
      for (const key of ['kind', 'role', 'classification', 'fromCardinality', 'toCardinality']) if (edge[key] !== undefined) expect(match![key], `${edge.from} → ${edge.to} ${key}`).toEqual(edge[key]);
      for (const key of ['fromOptional', 'toOptional']) if (type === 'erd') expect(!!match![key]).toBe(!!edge[key]);
      if (type === 'erd') expect(match!.identifying !== false).toBe(edge.identifying !== false);
    }
  }
  if (original.mainPath) expect(actual.mainPath).toEqual((original.mainPath as string[]).map(id => ids.get(id)));
  if (type === 'architecture') for (const boundary of records(original, 'boundaries')) {
    const wanted = (boundary.wraps as string[]).map(id => ids.get(id)).sort();
    const match = records(actual, 'boundaries').find(value => value.kind === boundary.kind && JSON.stringify([...(value.wraps as string[])].sort()) === JSON.stringify(wanted));
    expect(match?.kind, boundary.label + ' boundary kind and membership').toBe(boundary.kind);
  }
  if (type === 'workflow') {
    const laneIds = new Map(records(original, 'lanes').map(lane => [lane.id, records(actual, 'lanes').find(value => value.label === lane.label)!.id]));
    for (const node of expectedNodes) {
      const match = actualNodes.find(value => value.id === ids.get(node.id))!;
      expect(match.lane).toBe(laneIds.get(String(node.lane))); expect(match.col).toBe(node.col);
    }
    for (const key of ['phases', 'groups', 'lanes']) for (const item of records(original, key)) {
      const match = records(actual, key).find(value => value.label === item.label)!;
      expect(match, String(item.label)).toBeDefined();
      expect(match.variant || 'default').toBe(item.variant || 'default');
      for (const field of ['fromCol', 'toCol']) if (item[field] !== undefined) expect(match[field], `${item.label} ${field}`).toBe(item[field]);
      if (item.lane) expect(match.lane).toBe(laneIds.get(String(item.lane)));
    }
  }
  if (type === 'dataflow') {
    expect(records(actual, 'stages').map(stage => stage.label)).toEqual(records(original, 'stages').map(stage => stage.label));
    for (const node of expectedNodes) expect(actualNodes.find(value => value.id === ids.get(node.id))!.stage).toBe(node.stage);
  }
  if (type === 'sequence') {
    const before = original.messages as ArchifyRelation[], after = actual.messages as ArchifyRelation[];
    const coverage = (document: ArchifyDocument, key: string, messages: ArchifyRelation[]) => records(document, key).map(item => ({
      name: key === 'activations' ? document === original ? ids.get(String(item.participant)) : item.participant : item.label,
      messages: messages.flatMap((message, index) => Number(message.y) >= Number(item.from) && Number(message.y) <= Number(item.to) ? [index] : []),
    })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    expect(coverage(actual, 'activations', after)).toEqual(coverage(original, 'activations', before));
    expect(coverage(actual, 'segments', after)).toEqual(coverage(original, 'segments', before));
  }
}

describe('all pinned Archify examples through their authored Mermaid', () => {
  it('preserves semantic records and uses every official drawing family', async () => {
    const results: { example: string; ok: boolean; error?: string; bytes?: number }[] = [];
    for (const entry of catalog.cases) {
      const models = compileDocument(readFileSync(`examples/compare/${entry.slug}.md`, 'utf8')).diagrams;
      for (const [index, source] of entry.sources.entries()) {
        try {
          const original = JSON.parse(readFileSync(`tests/fixtures/archify/${source.file}`, 'utf8')) as ArchifyDocument;
          const parsed = await parseMermaid(models[index]), projection = await archifyProjection(parsed);
          const presentation = archifyExamplePresentation.diagrams?.[models[index].id];
          projection.document.meta.visual_preset = presentation?.preset || 'classic';
          if (presentation?.engineeringProfile) projection.document.meta.engineering_profile = presentation.engineeringProfile;
          expect(projection.document.meta.visual_preset).toBe(original.meta.visual_preset || 'classic');
          expect(projection.document.meta.engineering_profile).toBe(original.meta.engineering_profile);
          validateGraphReferences(models[index], parsed.graph);
          const expected = original[nodeKey[source.type]] as ArchifyNode[], actual = projection.document[nodeKey[source.type]] as ArchifyNode[];
          expect(actual.length, source.file + ' node count').toBe(expected.length);
          for (const node of expected) {
            const match = corresponding(actual, node);
            expect(match, source.file + ': ' + name(node)).toBeDefined();
            for (const key of ['sublabel', 'tag', 'brand', 'detail']) if (node[key] !== undefined) expect(match![key], `${source.file} ${name(node)} ${key}`).toEqual(node[key]);
            if (node.attributes) expect(match!.attributes, source.file + ' fields').toMatchObject(node.attributes);
            if (node.methods) expect(match!.methods, source.file + ' methods').toMatchObject(node.methods);
          }
          if (edgeKey[source.type]) expect((projection.document[edgeKey[source.type]] as unknown[]).length).toBe((original[edgeKey[source.type]] as unknown[]).length);
          for (const key of ['lanes', 'phases', 'groups', 'stages', 'segments', 'activations']) if (original[key]) expect((projection.document[key] as unknown[]).length, source.file + ' ' + key).toBe((original[key] as unknown[]).length);
          compareSemantics(original, projection.document, source.type);
          const result = await drawArchify(projection.document);
          expect(result.svg.startsWith('      <svg') || result.svg.trimStart().startsWith('<svg')).toBe(true);
          results.push({ example: source.file, ok: true, bytes: result.svg.length });
        } catch (error) { results.push({ example: source.file, ok: false, error: error instanceof Error ? error.message : String(error) }); }
      }
    }
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/archify-alignment-check.json', JSON.stringify(results, null, 2));
    expect(results.filter(result => !result.ok)).toEqual([]);
    expect(results).toHaveLength(25);
  }, 120000);
});
