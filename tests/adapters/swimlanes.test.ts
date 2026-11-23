/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import mermaid from 'mermaid';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import { compileDocument } from '../../src/protocol/parse.js';
import { blockMetadata } from '../../src/mermaid/adapters/block.js';
import { blockGrid, layoutSwimlanes } from '../../src/mermaid/swimlanes.js';
import { crossesBox, swimlaneRoute, type RoutePoint } from '../../src/mermaid/swimlane-route.js';
import { bindDiagram } from '../../src/mermaid/bind.js';

beforeAll(() => mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }));

describe('release delivery responsibility and phase semantics', () => {
  it('retains six lanes, three phases, two workgroups and every forward, stop and restore relationship', async () => {
    const model = compileDocument(readFileSync('examples/compare/release-delivery.md', 'utf8')).diagrams[0];
    const native = await mermaid.mermaidAPI.getDiagramFromText(model.source), db = native.db as BlockDB;
    const metadata = blockMetadata(db, 'release');
    expect(model.type).toBe('block');
    expect(model.steps).toEqual([]);
    expect([...metadata.elements.values()].filter(item => item.classes?.includes('ccv-swimlane')).map(item => item.dataId)).toEqual(['lane_0', 'lane_1', 'lane_2', 'lane_3', 'lane_4', 'lane_5']);
    expect(metadata.elements.get('node:n_build')?.parents).toEqual(['workgroup_1_0', 'lane_1']);
    expect(metadata.elements.get('node:n_rollback')?.parents).toEqual(['workgroup_5_0', 'lane_5']);
    expect([...metadata.elements.values()].filter(item => item.classes?.includes('ccv-phase')).map(item => item.label)).toEqual(['Change', 'Build + verify', 'Promote + observe']);
    expect(db.getEdges().map(edge => [edge.start, edge.end, edge.label || ''])).toEqual([
      ['n_commit', 'n_pull_request', ''], ['n_pull_request', 'n_build', 'merge'],
      ['n_build', 'n_checks', ''], ['n_checks', 'n_approval', ''],
      ['n_approval', 'n_deploy', ''], ['n_deploy', 'n_verify_prod', ''],
      ['n_verify_prod', 'n_announce', 'healthy'], ['n_checks', 'n_failed', 'red'],
      ['n_verify_prod', 'n_rollback', ''], ['n_rollback', 'n_deploy', 'restore'],
    ]);
    expect(db.getEdges().filter(edge => edge.thickness === 'thick')).toHaveLength(3);
    expect(db.getEdges().filter(edge => edge.pattern === 'dotted')).toHaveLength(4);
    for (const ref of metadata.elements.keys()) expect(model.details[ref]).toBeDefined();
    const grid = blockGrid(db);
    expect(grid.columns).toBe(1);
    const ci = grid.children.find(node => node.id === 'lane_1')!;
    expect(ci.columns).toBe(6);
    expect(ci.children.find(node => node.id === 'workgroup_1_0')?.span).toBe(2);

    // Native identities and labels are retained while the marked grid is laid out.
    const elements = [...metadata.elements.values()];
    const markup = elements.filter(item => !item.from).map(item => `<g class="node ${(item.classes || []).join(' ')}" id="${item.domId}"><rect class="label-container ${item.ref.startsWith('group:') ? 'composite' : ''}"/><g class="label" data-width="${item.label.length * 5}" data-height="30"><text>${item.label.replaceAll('&', '&amp;')}</text></g></g>`).join('');
    const edges = elements.filter(item => item.from).map(item => `<path id="${item.domId}" class="flowchart-link" marker-end="url(#arrow)" style="stroke-dasharray:4,4"/>`).join('');
    const previousMeasure = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');
    Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: function (this: SVGElement) {
      return new DOMRect(0, 0, Number(this.getAttribute('data-width')) || 0, Number(this.getAttribute('data-height')) || 0);
    } });
    try {
      const svg = layoutSwimlanes(`<svg><defs><marker id="arrow"/></defs>${markup}${edges}</svg>`, grid, metadata);
      const container = document.createElement('div'); container.innerHTML = svg;
      const output = container.querySelector('svg')!;
      const bindings = bindDiagram(output, metadata, {});
      expect(bindings.size).toBe(metadata.elements.size);
      expect(output.querySelectorAll('path.flowchart-link')).toHaveLength(10);
      expect(output.querySelectorAll('.ccv-swimlane')).toHaveLength(6);
      expect([...output.querySelectorAll('path.flowchart-link')].every(path => path.getAttribute('marker-end') === 'url(#arrow)' && path.getAttribute('style') === 'stroke-dasharray:4,4')).toBe(true);
      expect(output.querySelectorAll('[data-ccv-route]')).toHaveLength(10);
      const boxes = new Map([...output.querySelectorAll<SVGGElement>('g.node')].map(node => {
        const [x, y] = node.getAttribute('transform')!.slice(10, -1).split(',').map(Number);
        const rect = node.querySelector('rect')!, width = Number(rect.getAttribute('width')), height = Number(rect.getAttribute('height'));
        return [node.id, { x: x - width / 2, y: y - height / 2, width, height }];
      }));
      const lanes = [...output.querySelectorAll('.ccv-swimlane')].map(node => boxes.get(node.id)!);
      expect(new Set(lanes.map(box => box.width)).size).toBe(1);
      expect(lanes.every((box, i) => !i || box.y > lanes[i - 1].y + lanes[i - 1].height)).toBe(true);
      for (const item of metadata.elements.values()) if (item.parents[0]) {
        const box = boxes.get(item.domId!)!, parent = metadata.elements.get(`group:${item.parents[0]}`)!, frame = boxes.get(parent.domId!)!;
        expect(box.x).toBeGreaterThanOrEqual(frame.x);
        expect(box.y).toBeGreaterThanOrEqual(frame.y);
        expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + .001);
        expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + .001);
      }
      expect(document.body.querySelector('[style*="-100000px"]')).toBeNull();
    } finally {
      if (previousMeasure) Object.defineProperty(SVGElement.prototype, 'getBBox', previousMeasure);
      else Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
    }
  }, 15000);
});

describe('orthogonal swimlane connections', () => {
  const source = { x: 0, y: 0, width: 100, height: 70 };
  it('keeps aligned neighbors straight even with a narrow gap', () => {
    const target = { ...source, x: 132 };
    expect(swimlaneRoute(source, target, [source, target])).toEqual([[100, 35], [132, 35]]);
  });
  it('avoids an intermediate card and separates a return from an occupied route', () => {
    const target = { ...source, y: 500 }, obstacle = { ...source, y: 220 };
    const route = swimlaneRoute(source, target, [source, target, obstacle]);
    expect(route.length).toBeGreaterThan(2);
    for (let i = 1; i < route.length; i++) {
      expect(route[i][0] === route[i - 1][0] || route[i][1] === route[i - 1][1]).toBe(true);
      expect(crossesBox(route[i - 1], route[i], obstacle)).toBe(false);
    }
    const occupied: RoutePoint[][] = [[[0, 535], [-26, 535], [-26, 35], [0, 35]]];
    const restored = swimlaneRoute(target, source, [source, target, obstacle], occupied);
    expect(restored).not.toEqual(occupied[0]);
    expect(restored[0][0] === target.x || restored[0][0] === target.x + target.width).toBe(true);
    expect(restored.at(-1)![0] === source.x || restored.at(-1)![0] === source.x + source.width).toBe(true);
  });
  it('reports a blocked connection instead of drawing through a node', () => {
    const target = { ...source, y: 500 };
    expect(() => swimlaneRoute(source, target, [source, target, { x: -1000, y: -1000, width: 2000, height: 2000 }])).toThrow(/无法避开/);
  });
});
