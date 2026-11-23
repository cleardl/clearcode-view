import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { BlockDB } from 'mermaid/dist/diagrams/block/blockDB.js';
import type { Block } from 'mermaid/dist/diagrams/block/blockTypes.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { Mermaid } from 'mermaid';
import { parse as readYaml } from 'yaml';
import type { ParsedDiagram } from '../../core/graph.js';
import { visibleReference } from '../../core/graph.js';
import type { ElementRef } from '../../core/model.js';
import { withMermaid } from '../../mermaid/engine.js';
import { sequenceMetadata } from '../../mermaid/adapters/sequence.js';
import { diagramAnnotations, type DiagramAnnotations, type SemanticAttributes } from '../../mermaid/annotations.js';
import { placeCards } from './layout.js';
import { projectStructured } from './structured.js';
import type { ArchifyDocument, ArchifyKind, ArchifyNode, ArchifyProjection, ArchifyRelation } from './model.js';

const nodesCollection: Record<ArchifyKind, string> = { architecture: 'components', workflow: 'nodes', sequence: 'participants', dataflow: 'nodes', lifecycle: 'states', erd: 'entities', class: 'types', tree: 'nodes', timeline: 'events', waterfall: 'spans' };
const edgesCollection: Partial<Record<ArchifyKind, string>> = { architecture: 'connections', workflow: 'edges', sequence: 'messages', dataflow: 'flows', lifecycle: 'transitions', erd: 'relationships', class: 'relationships' };

function validateAnnotations(projection: ArchifyProjection, diagram: ParsedDiagram, annotations: DiagramAnnotations): void {
  const ids = (collection?: string): string[] => collection ? ((projection.document[collection] || []) as { id: string }[]).map(item => item.id) : [];
  const nodes = new Set([...ids(nodesCollection[projection.document.diagram_type]), ...ids('phases')]);
  const edges = new Set(ids(edgesCollection[projection.document.diagram_type]).map(id => projection.document.diagram_type === 'workflow' ? id.slice(2) : id));
  const groups = new Set(['boundaries', 'stages', 'lanes', 'groups'].flatMap(ids));
  for (const item of diagram.graph.elements.values()) {
    const [family, ...id] = item.ref.split(':');
    (family === 'group' ? groups : family === 'edge' || family === 'message' ? edges : nodes).add(id.join(':'));
  }
  for (const [name, collection, known] of [['node', annotations.nodes, nodes], ['edge', annotations.edges, edges], ['group', annotations.groups, groups]] as const) {
    for (const id of collection.keys()) if (!known.has(id)) throw new Error(`ccv:${name} 引用了不存在的元素：${id}`);
  }
}

export function labelParts(value: string): Pick<ArchifyNode, 'label' | 'sublabel' | 'tag'> {
  const [label, sublabel, ...tag] = value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").split(/<br\s*\/?\s*>|\n/gi);
  return { label, ...(sublabel ? { sublabel } : {}), ...(tag.length ? { tag: tag.join(' · ') } : {}) };
}
function role(classes: string[] = [], shape = ''): string {
  return classes.map(value => value.replace(/^ccv-/, '')).find(value => ['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'].includes(value)) || (shape === 'cylinder' ? 'database' : 'backend');
}
function variant(thickness?: string, pattern?: string, classes: string[] = []): string {
  return classes.includes('ccv-security') ? 'security' : thickness === 'thick' ? 'emphasis' : pattern === 'dotted' || classes.includes('ccv-messagebus') ? 'dashed' : 'default';
}
function nodeAttributes(attributes: SemanticAttributes | undefined): Record<string, unknown> {
  if (!attributes) return {};
  const { kind: _kind, variant: _variant, role: _role, main: _main, ...content } = attributes;
  return content;
}
function reference(projection: ArchifyProjection, diagram: ParsedDiagram, id: string, family: 'node' | 'edge' | 'group' | 'participant' | 'message'): void {
  const ref: ElementRef = `${family}:${id}`;
  if (!diagram.graph.elements.has(ref)) return;
  (family === 'edge' || family === 'message' ? projection.edgeRefs : family === 'group' ? projection.groupRefs : projection.nodeRefs).set(id, ref);
}
function orderedMain(nodes: ArchifyNode[], edges: ArchifyRelation[], annotations: DiagramAnnotations): string[] {
  const marked = nodes.filter(node => annotations.nodes.get(node.id)?.main).map(node => node.id);
  if (!marked.length) return [];
  const remaining = new Set(marked), path: string[] = [];
  let current = marked.find(id => !edges.some(edge => remaining.has(edge.from) && edge.to === id));
  while (current && remaining.delete(current)) { path.push(current); current = edges.find(edge => edge.from === current && remaining.has(edge.to))?.to; }
  if (remaining.size) throw new Error('主路径标记必须构成一条有向路径');
  return path;
}

async function flow(db: FlowDB, diagram: ParsedDiagram, projection: ArchifyProjection, annotations: DiagramAnnotations, collapsed: Record<string, boolean>): Promise<void> {
  const groups = db.getSubGraphs(), groupIds = new Set(groups.map(group => group.id));
  const nodes: ArchifyNode[] = [];
  const visibleId = (id: string) => visibleReference(`node:${id}`, diagram.graph, collapsed).split(':').slice(1).join(':');
  for (const [id, vertex] of db.getVertices()) if (!groupIds.has(id) && visibleId(id) === id) {
    nodes.push({ id, ...labelParts(vertex.text || id), type: role(vertex.classes, vertex.type), ...nodeAttributes(annotations.nodes.get(id)) });
    reference(projection, diagram, id, 'node');
  }
  for (const group of groups) if (collapsed[group.id]) {
    const ref = visibleReference(`group:${group.id}`, diagram.graph, collapsed);
    if (ref !== `group:${group.id}`) continue;
    nodes.push({ id: group.id, label: group.title, type: role(group.classes) });
    projection.nodeRefs.set(group.id, ref);
  }
  if (db.getEdges().some(edge => edge.start === edge.end)) throw new Error('Archify 架构尚未适配 Mermaid 自连线，请使用原生绘制后端');
  const edges: ArchifyRelation[] = db.getEdges().map((edge, i) => ({
    id: edge.id || `edge-${i}`, from: visibleId(edge.start), to: visibleId(edge.end), ...labelParts(edge.text || ''),
    variant: variant(edge.stroke, edge.stroke, edge.classes), ...annotations.edges.get(edge.id || `edge-${i}`),
  })).filter(edge => edge.from !== edge.to);
  for (const edge of edges) reference(projection, diagram, edge.id, 'edge');
  if (projection.document.diagram_type === 'tree') {
    for (const node of nodes) {
      const parents = edges.filter(edge => edge.to === node.id);
      if (parents.length > 1) throw new Error(`树节点 ${node.id} 有多个父关系，请使用架构图或数据流图`);
      if (parents[0]) node.parent = parents[0].from;
    }
    projection.document.nodes = nodes;
    projection.document.layout = { direction: db.getDirection() === 'LR' ? 'right' : 'down' };
    return;
  }
  if (projection.document.diagram_type === 'dataflow') {
    const stages = groups.filter(group => !diagram.graph.elements.get(`group:${group.id}`)?.parents.length);
    const maxCount = Math.max(1, ...stages.map(group => nodes.filter(node => node.id === group.id || diagram.graph.elements.get(`node:${node.id}`)?.parents.includes(group.id)).length));
    stages.forEach((stage, index) => {
      reference(projection, diagram, stage.id, 'group');
      const members = nodes.filter(node => node.id === stage.id || diagram.graph.elements.get(`node:${node.id}`)?.parents.includes(stage.id));
      members.forEach((node, row) => { node.stage = index; node.row = Math.round(members.length === 1 ? (maxCount - 1) / 2 : row * (maxCount - 1) / (members.length - 1)); });
    });
    projection.document.stages = stages.map(group => ({ id: group.id, label: group.title }));
    projection.document.nodes = nodes;
    projection.document.flows = edges.map(edge => { const { sublabel, tag: _tag, ...data } = edge; return { ...data, ...(sublabel ? { classification: sublabel } : {}) }; });
    return;
  }
  const containers = groups.filter(group => !collapsed[group.id]).map(group => ({ id: group.id, parent: diagram.graph.elements.get(`group:${group.id}`)?.parents.find(id => !collapsed[id]), members: nodes.filter(node => (diagram.graph.elements.get(`node:${node.id}`)?.parents || diagram.graph.elements.get(`group:${node.id}`)?.parents || []).includes(group.id)).map(node => node.id) })).filter(group => group.members.length);
  await placeCards(nodes, edges, db.getDirection() || 'TB', undefined, containers);
  projection.document.components = nodes;
  projection.document.connections = edges.map(edge => ({ ...edge, route: 'auto' }));
  projection.document.boundaries = groups.filter(group => !collapsed[group.id] && visibleReference(`group:${group.id}`, diagram.graph, collapsed) === `group:${group.id}`).map(group => {
    reference(projection, diagram, group.id, 'group');
    return { id: group.id, label: group.title, kind: annotations.groups.get(group.id)?.kind || 'region', wraps: nodes.filter(node => node.id !== group.id && (diagram.graph.elements.get(`node:${node.id}`)?.parents.includes(group.id) || diagram.graph.elements.get(`group:${node.id}`)?.parents.includes(group.id))).map(node => node.id) };
  }).filter(group => group.wraps.length);
}

function workflow(db: BlockDB, diagram: ParsedDiagram, projection: ArchifyProjection, annotations: DiagramAnnotations): void {
  const blocks = db.getBlocks(), nodes: ArchifyNode[] = [], lanes: Record<string, unknown>[] = [], groups: Record<string, unknown>[] = [], phases: Record<string, unknown>[] = [];
  const roots = blocks.filter(block => block.type === 'composite');
  const phaseRoot = roots.find(block => block.children?.some(child => child.classes?.includes('ccv-phase')));
  if (phaseRoot) {
    projection.phaseContainer = `group:${phaseRoot.id}`;
    let column = 0;
    for (const block of phaseRoot.children.filter(child => child.type !== 'column-setting')) {
      const span = block.widthInColumns || 1;
      if (block.type !== 'space') { phases.push({ id: block.id, label: block.label, fromCol: column, toCol: column + span - 1, ...annotations.nodes.get(block.id) }); projection.phaseRefs.set(block.id, `node:${block.id}`); }
      column += span;
    }
  }
  const laneBlocks = roots.filter(block => block !== phaseRoot);
  for (const lane of laneBlocks) {
    lanes.push({ id: lane.id, label: lane.label?.replace(/^(?:\d+|EX)\s*\/\s*/, ''), ...annotations.groups.get(lane.id) });
    reference(projection, diagram, lane.id, 'group');
    const visit = (children: Block[], start: number, span: number, columns: number): void => {
      let cursor = 0;
      for (const block of children) {
        if (['column-setting', 'edge', 'classDef', 'applyClass', 'applyStyles'].includes(block.type || '')) continue;
        const width = block.widthInColumns || 1, column = start + (cursor % columns) * span / columns, row = Math.floor(cursor / columns);
        if (block.type === 'composite') {
          groups.push({ id: block.id, label: block.label, lane: lane.id, fromCol: column, toCol: column + width * span / columns - 1, ...annotations.groups.get(block.id) });
          reference(projection, diagram, block.id, 'group');
          visit(block.children, column, width * span / columns, block.columns && block.columns > 0 ? block.columns : block.children.length);
        } else if (block.type !== 'space') {
          nodes.push({ id: block.id, ...labelParts(block.label || block.id), lane: lane.id, col: column, ...(row ? { row } : {}), type: role(block.classes, block.type), ...nodeAttributes(annotations.nodes.get(block.id)) });
          reference(projection, diagram, block.id, 'node');
        }
        cursor += width;
      }
    };
    const columns = lane.columns && lane.columns > 0 ? lane.columns : 6;
    visit(lane.children, 0, columns, columns);
  }
  const edges: ArchifyRelation[] = db.getEdges().map((edge, index) => ({ id: 'e_' + (edge.id || `edge-${index}`), from: edge.start!, to: edge.end!, label: edge.label || '', variant: variant(edge.thickness, edge.pattern, edge.classes), ...annotations.edges.get(edge.id) }));
  for (const [index, edge] of db.getEdges().entries()) if (diagram.graph.elements.has(`edge:${edge.id}`)) projection.edgeRefs.set(edges[index].id, `edge:${edge.id}`);
  Object.assign(projection.document, { schema_version: 2, lanes, groups, phases, nodes, edges, mainPath: orderedMain(nodes, edges, annotations) });
}

async function blockArchitecture(db: BlockDB, diagram: ParsedDiagram, projection: ArchifyProjection, annotations: DiagramAnnotations): Promise<void> {
  const blocks = db.getBlocksFlat().filter(block => !['root', 'space', 'edge', 'column-setting', 'classDef', 'applyClass', 'applyStyles'].includes(block.id) && !['space', 'edge', 'column-setting', 'classDef', 'applyClass', 'applyStyles'].includes(block.type || ''));
  const nodes = blocks.filter(block => block.type !== 'composite').map(block => {
    reference(projection, diagram, block.id, 'node');
    return { id: block.id, ...labelParts(block.label || block.id), type: role(block.classes, block.type), ...nodeAttributes(annotations.nodes.get(block.id)) };
  });
  const edges = db.getEdges().map((edge, index) => {
    const id = edge.id || `edge-${index}`; reference(projection, diagram, id, 'edge');
    return { id, from: edge.start!, to: edge.end!, label: edge.label || '', variant: variant(edge.thickness, edge.pattern, edge.classes), ...annotations.edges.get(id) };
  });
  const boundaries = blocks.filter(block => block.type === 'composite').map(block => {
    reference(projection, diagram, block.id, 'group');
    return { id: block.id, label: block.label || block.id, kind: annotations.groups.get(block.id)?.kind || 'region', wraps: nodes.filter(node => diagram.graph.elements.get(`node:${node.id}`)?.parents.includes(block.id)).map(node => node.id) };
  });
  const containers = boundaries.map(boundary => ({ id: boundary.id, parent: diagram.graph.elements.get(`group:${boundary.id}`)?.parents[0], members: boundary.wraps }));
  await placeCards(nodes, edges, db.getBlocks()[0]?.columns === 1 ? 'TB' : 'LR', undefined, containers);
  Object.assign(projection.document, { components: nodes, connections: edges.map(edge => ({ ...edge, route: 'auto' })), boundaries });
}

async function sequence(db: SequenceDB, engine: Mermaid, diagram: ParsedDiagram, projection: ArchifyProjection, annotations: DiagramAnnotations): Promise<void> {
  const actors = [...db.getActors()], records = [...db.getMessages()].map(record => ({ ...record }));
  const metadata = await sequenceMetadata(engine, diagram.input, db);
  const ids = new Map([...metadata.elements.values()].filter(item => item.ref.startsWith('message:')).map(item => [item.dataId, item.ref]));
  const participants: ArchifyNode[] = actors.map(([id, actor]) => {
    reference(projection, diagram, id, 'participant');
    const ownRole = typeof actor.properties.ccvRole === 'string' ? actor.properties.ccvRole : actor.type === 'database' ? 'database' : actor.type === 'queue' ? 'messagebus' : actor.type === 'actor' ? 'external' : 'backend';
    return { id, ...labelParts(actor.description || actor.name), type: ownRole, ...nodeAttributes(annotations.nodes.get(id)) };
  });
  const messages: ArchifyRelation[] = [], activations: Record<string, unknown>[] = [], segments: { from: number; to: number; label: string }[] = [];
  const active = new Map<string, number[]>(), fragments: { from: number; to: number; label: string }[] = [];
  let y = 180, lastY = y;
  for (const [index, record] of records.entries()) {
    const type = record.type || 0, text = typeof record.message === 'string' ? record.message : '';
    if (type === 17) { const stack = active.get(record.from!) || []; stack.push(y - 6); active.set(record.from!, stack); continue; }
    if (type === 18) { const start = active.get(record.from!)?.pop(); if (start !== undefined) activations.push({ participant: record.from, from: start, to: lastY + 6, type: participants.find(actor => actor.id === record.from)?.type }); continue; }
    if ([10, 12, 15, 19, 22, 27, 30, 32].includes(type)) {
      y += 30; fragments.push({ from: y - 30, to: y, label: type === 22 ? '' : ({ 10: 'loop', 12: 'alt', 15: 'opt', 19: 'par', 27: 'critical', 30: 'break', 32: 'par' }[type] || '') + ' ' + text }); continue;
    }
    if ([11, 14, 16, 21, 23, 29, 31].includes(type)) { const fragment = fragments.pop(); if (fragment) { fragment.to = Math.max(lastY + 24, fragment.from + 60); segments.push(fragment); } y += 30; continue; }
    if ([13, 20, 28].includes(type)) { const fragment = fragments.at(-1); if (fragment) { segments.push({ ...fragment, to: lastY + 24 }); y += 36; fragment.from = y - 30; fragment.label = `${type === 13 ? 'else' : 'and'} ${text}`; } continue; }
    if (type === 2) {
      const fragment = fragments.at(-1), message = messages.at(-1);
      if (fragment && !fragment.label) fragment.label = text;
      else if (message) {
        message.note = text;
        if (message.from === message.to) {
          const { minimumNodeTextWidth } = await import('./upstream/shared/text-fit.mjs');
          y += 11 * (Math.ceil(minimumNodeTextWidth(text, 7) / 110) + 1);
        }
      } else throw new Error('前置独立 Note 需要放入 Mermaid rect 分段中');
      continue;
    }
    if (type === 26) continue;
    if (!record.from || !record.to) throw new Error(`未适配的 Mermaid 时序语句类型 ${type}`);
    const ref = ids.get(`i${index}`), id = ref ? ref.slice(8) : `message-${messages.length}`;
    if (ref) projection.edgeRefs.set(id, ref);
    messages.push({ id, from: record.from, to: record.to, label: text, y, variant: [1, 4, 6, 25, 34].includes(type) ? 'return' : [5, 24].includes(type) ? 'dashed' : 'default', ...annotations.edges.get(id) });
    lastY = y + (record.from === record.to ? 24 : 0); y = lastY + 54;
  }
  if (fragments.length) throw new Error('时序控制结构没有结束');
  for (const [id, stack] of active) for (const start of stack) activations.push({ participant: id, from: start, to: lastY + 6 });
  Object.assign(projection.document, { participants, messages, activations, segments: segments.sort((a, b) => a.from - b.from) });
}

/** Project native Mermaid to each official drawing vocabulary; source and reading IDs remain authoritative. */
export function archifyProjection(diagram: ParsedDiagram, collapsed: Record<string, boolean> = {}): Promise<ArchifyProjection> {
  return withMermaid({}, async engine => {
    const annotations = diagramAnnotations(diagram.input), native = await engine.mermaidAPI.getDiagramFromText(diagram.input.source);
    const guessed: Record<string, ArchifyKind> = { 'flowchart-v2': 'architecture', flowchart: 'architecture', block: [...diagram.graph.elements.values()].some(item => item.classes?.includes('ccv-swimlane')) ? 'workflow' : 'architecture', sequence: 'sequence', er: 'erd', classDiagram: 'class', stateDiagram: 'lifecycle', 'stateDiagram-v2': 'lifecycle', gantt: 'waterfall' };
    const kind = annotations.diagram?.kind || guessed[native.type];
    if (!kind) throw new Error(`Archify 绘制器不支持 ${native.type}`);
    const compatible = diagram.graph.type === 'flowchart' ? ['architecture', 'dataflow', 'tree'] : native.type === 'block' ? ['architecture', 'workflow'] : native.type === 'gantt' ? ['timeline', 'waterfall'] : [guessed[native.type]];
    if (!compatible.includes(kind)) throw new Error(`Mermaid ${native.type} 不能作为 ${kind} 绘制`);
    const frontmatter = diagram.input.source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const header = frontmatter ? readYaml(frontmatter[1]) as { title?: string } : undefined;
    const title = header?.title || (native.db as { getDiagramTitle?(): string }).getDiagramTitle?.() || 'Diagram';
    const document: ArchifyDocument = { schema_version: 1, diagram_type: kind, meta: { title, output: 'diagram.html', quality_profile: 'showcase', ...annotations.diagram } };
    delete document.meta.kind;
    if (annotations.diagram?.legend) document.meta.legend = { entries: Object.fromEntries(Object.entries(annotations.diagram.legend).map(([id, label]) => [id, { label }])) };
    const projection: ArchifyProjection = { document, nodeRefs: new Map(), edgeRefs: new Map(), groupRefs: new Map(), phaseRefs: new Map() };
    if (native.type === 'block') {
      if (kind === 'workflow') workflow(native.db as BlockDB, diagram, projection, annotations);
      else if (kind === 'architecture') await blockArchitecture(native.db as BlockDB, diagram, projection, annotations);
      else throw new Error(`Mermaid block 不能作为 ${kind} 绘制`);
    }
    else if (native.type === 'sequence') await sequence(native.db as SequenceDB, engine, diagram, projection, annotations);
    else if (diagram.graph.type === 'flowchart') await flow(native.db as FlowDB, diagram, projection, annotations, collapsed);
    else await projectStructured(native.db, kind, projection, annotations);
    validateAnnotations(projection, diagram, annotations);
    return projection;
  });
}
