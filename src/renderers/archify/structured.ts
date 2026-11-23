import type { DiagramDB } from 'mermaid/dist/diagram-api/types.js';
import type { ErDB } from 'mermaid/dist/diagrams/er/erDb.js';
import type { ClassDB } from 'mermaid/dist/diagrams/class/classDb.js';
import type { ClassMember } from 'mermaid/dist/diagrams/class/classTypes.js';
import type { Stmt } from 'mermaid/dist/diagrams/state/stateDb.js';
import type { DiagramAnnotations } from '../../mermaid/annotations.js';
import { labelParts } from './projection.js';
import { placeCards } from './layout.js';
import type { ArchifyKind, ArchifyNode, ArchifyProjection, ArchifyRelation } from './model.js';

interface GanttTask {
  id: string; task: string; section: string; startTime: Date; endTime: Date;
  raw: { startTime: { startData: string }; endTime: { data: string } };
}
interface GanttReader { getTasks(): GanttTask[]; getSections(): string[] }
interface StateReader { getRootDocV2(): { doc?: Stmt[] } }
const visibility: Record<string, string> = { '+': 'public', '-': 'private', '#': 'protected', '~': 'package' };

function member(item: ClassMember): Record<string, unknown> {
  const generics = (value: string) => value.replace(/~([^~]+)~/g, '<$1>');
  const qualifiers = { ...(visibility[item.visibility] ? { visibility: visibility[item.visibility] } : {}), ...(item.classifier === '$' ? { static: true } : {}), ...(item.classifier === '*' ? { abstract: true } : {}) };
  if (item.memberType === 'method') return { name: item.id, parameters: generics(item.parameters), ...(item.returnType ? { returns: generics(item.returnType) } : {}), ...qualifiers };
  const words = item.id.trim().split(/\s+/), name = words.pop()!;
  return { name, ...(words.length ? { type: generics(words.join(' ')) } : {}), ...qualifiers };
}

/** Preserve field, UML, state and temporal semantics in their dedicated official drawing engines. */
export async function projectStructured(db: DiagramDB, kind: ArchifyKind, projection: ArchifyProjection, annotations: DiagramAnnotations): Promise<void> {
  if (kind === 'erd') {
    const er = db as ErDB, byNativeId = new Map([...er.getEntities()].map(([id, entity]) => [entity.id, id]));
    const entities: ArchifyNode[] = [...er.getEntities()].map(([id, entity]) => ({
      id, label: entity.alias || entity.label || id, ...annotations.nodes.get(id),
      attributes: entity.attributes.map(attribute => ({
        name: attribute.name, type: attribute.type,
        ...(attribute.keys.length ? { key: attribute.keys.length === 1 ? attribute.keys[0].toLowerCase() : attribute.keys.map(key => key.toLowerCase()) } : {}),
        ...(attribute.comment?.match(/references\s+([^;]+)/i) ? { references: attribute.comment.match(/references\s+([^;]+)/i)![1].trim() } : {}),
        ...(/(?:^|;)\s*nullable\b/i.test(attribute.comment || '') ? { nullable: true } : {}),
      })),
    }));
    const cardinality = (value: string) => /MORE/.test(value) ? 'many' : 'one';
    const relationships: ArchifyRelation[] = er.getRelationships().map((edge, i) => ({
      id: `relationship-${i}`, from: byNativeId.get(edge.entityA)!, to: byNativeId.get(edge.entityB)!, label: edge.roleA || '',
      fromCardinality: cardinality(edge.relSpec.cardB), toCardinality: cardinality(edge.relSpec.cardA),
      fromOptional: /ZERO/.test(edge.relSpec.cardB), toOptional: /ZERO/.test(edge.relSpec.cardA), identifying: edge.relSpec.relType === 'IDENTIFYING',
      ...annotations.edges.get(`relationship-${i}`),
    }));
    const sizes = new Map(entities.map(entity => [entity.id, { width: Math.max(240, ...((entity.attributes as { name: string; type: string }[]).map(field => field.name.length * 6.5 + field.type.length * 6.3 + 94))), height: 36 + (entity.attributes as unknown[]).length * 20 }]));
    const domains = [...new Set(entities.map(entity => String(entity.tag || '')))], rowCounts = new Map<string, number>();
    for (const entity of entities) { const domain = String(entity.tag || ''); entity.col = domains.indexOf(domain); entity.row = rowCounts.get(domain) || 0; rowCounts.set(domain, Number(entity.row) + 1); entity.width = sizes.get(entity.id)!.width; }
    Object.assign(projection.document, { entities, relationships, layout: { mode: 'grid', gapX: 112, gapY: 64 } });
    return;
  }
  if (kind === 'class') {
    const classes = db as ClassDB;
    const types: ArchifyNode[] = [...classes.getClasses()].map(([id, node]) => ({
      id, label: node.label || id, kind: node.annotations.includes('interface') ? 'interface' : node.annotations.some(value => /abstract/i.test(value)) ? 'abstract' : node.annotations.some(value => /enum/i.test(value)) ? 'enum' : 'class',
      attributes: node.members.map(member), methods: node.methods.map(member), ...annotations.nodes.get(id),
    }));
    const relationships: ArchifyRelation[] = classes.getRelations().map((edge, i) => {
      const marker = edge.relation.type1 !== undefined && String(edge.relation.type1) !== 'none' ? edge.relation.type1 : edge.relation.type2;
      const relationKind = marker === 0 ? 'aggregation' : marker === 2 ? 'composition' : marker === 1 ? edge.relation.lineType === 1 ? 'realization' : 'inheritance' : marker === 3 && edge.relation.lineType === 1 ? 'dependency' : 'association';
      return { id: `relationship-${i}`, from: edge.id1, to: edge.id2, kind: relationKind, label: edge.title || '', ...annotations.edges.get(`relationship-${i}`) };
    });
    const sizes = new Map(types.map(node => {
      const members = [...node.attributes as Record<string, unknown>[], ...node.methods as Record<string, unknown>[]];
      return [node.id, { width: Math.max(200, node.label.length * 8 + 48, ...members.map(item => JSON.stringify(item).length > 80 ? 300 : 250)), height: 44 + members.length * 20 + 22 }];
    }));
    await placeCards(types, relationships, 'TB', sizes);
    Object.assign(projection.document, { types, relationships });
    return;
  }
  if (kind === 'lifecycle') {
    const root = (db as StateReader).getRootDocV2(), states = new Map<string, ArchifyNode>(), transitions: ArchifyRelation[] = [];
    const visit = (statements: Stmt[]) => {
      for (const statement of statements) {
        if (statement.stmt === 'state' || statement.stmt === 'default') {
          const previous = states.get(statement.id);
          if (!previous || statement.description) states.set(statement.id, { id: statement.id, ...labelParts(statement.description || (statement.type === 'start' ? 'Start' : statement.type === 'end' ? 'End' : statement.id)), type: statement.type === 'choice' ? 'decision' : statement.type === 'start' ? 'start' : statement.type === 'end' ? 'success' : 'active', ...annotations.nodes.get(statement.id) });
          if (statement.doc) throw new Error('Archify 生命周期尚未适配 Mermaid 组合状态，请使用平面状态定义或原生绘制后端');
        } else if (statement.stmt === 'relation') {
          for (const endpoint of [statement.state1, statement.state2]) if (!states.has(endpoint.id)) states.set(endpoint.id, { id: endpoint.id, label: endpoint.description || (endpoint.type === 'start' ? 'Start' : endpoint.type === 'end' ? 'End' : endpoint.id), type: endpoint.type === 'start' ? 'start' : endpoint.type === 'end' ? 'success' : 'active', ...annotations.nodes.get(endpoint.id) });
          const id = `transition-${transitions.length}`;
          transitions.push({ id, from: statement.state1.id, to: statement.state2.id, label: statement.description || '', ...annotations.edges.get(id) });
        }
      }
    };
    visit(root.doc || []);
    for (const node of states.values()) { const attributes = annotations.nodes.get(node.id); if (attributes?.kind) node.type = attributes.kind; delete node.kind; delete node.main; }
    const main = [...states.values()].filter(node => annotations.nodes.get(node.id)?.main).map(node => node.id);
    if (!main.length) {
      let current = [...states.values()].find(node => node.type === 'start')?.id || states.keys().next().value;
      while (current && !main.includes(current)) { main.push(current); current = transitions.find(edge => edge.from === current && !main.includes(edge.to))?.to; }
    }
    Object.assign(projection.document, { schema_version: 3, states: [...states.values()], transitions, ...(main.length ? { mainPath: main } : {}) });
    return;
  }
  const gantt = db as GanttReader, tasks = gantt.getTasks();
  if (kind === 'timeline') {
    const lanes = gantt.getSections().map((label, i) => ({ id: `lane-${i}`, label }));
    const events = tasks.map(task => ({ id: task.id, at: task.raw.startTime.startData, title: task.task.trim(), lane: lanes.find(lane => lane.label === task.section)?.id, kind: 'default', ...annotations.nodes.get(task.id) }));
    Object.assign(projection.document, { lanes, events });
    return;
  }
  if (kind === 'waterfall') {
    const spans = tasks.map(task => {
      const rawStart = task.raw.startTime.startData, rawEnd = task.raw.endTime.data;
      const start = /^-?\d+(?:\.\d+)?$/.test(rawStart) ? Number(rawStart) : task.startTime.getTime();
      const duration = rawEnd.match(/^([\d.]+)ms$/);
      return { id: task.id, name: task.task.replace(/^↳\s*/, '').replace(/\s*\([\d.]+ms\)$/, '').trim(), service: task.section, start, end: duration ? start + Number(duration[1]) : task.endTime.getTime(), ...annotations.nodes.get(task.id) };
    });
    Object.assign(projection.document, { spans });
    return;
  }
  throw new Error(`尚未适配的 Archify 图类型 ${kind}`);
}
