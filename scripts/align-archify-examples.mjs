import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { parse as readYaml, stringify } from 'yaml';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
for (const key of ['window', 'document', 'DOMParser', 'Node', 'Element', 'SVGElement']) globalThis[key] = dom.window[key];
const { compileDocument } = await import('../dist/index.js');
const { parseMermaid } = await import('../dist/mermaid.js');
const root = path.resolve(process.argv[2], 'archify/examples');
const catalog = JSON.parse(fs.readFileSync('examples/public/reference/archify/source.json', 'utf8'));
const quote = value => JSON.stringify(value).replaceAll('\\"', '&quot;');
const text = value => String(value).replaceAll('"', '&quot;').replaceAll('\n', '<br/>');
const label = node => [node.label, node.sublabel, node.tag].filter(Boolean).map(text).join('<br/>');
const normalize = value => String(value).toLowerCase().replace(/<br\s*\/?\s*>/g, ' ').replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const annotation = (kind, id, attributes) => `  %% ccv:${kind}${id ? ' ' + id : ''} ${JSON.stringify(attributes)}\n`;
function extras(node, kind, idMap) {
  const result = {};
  for (const key of ['brand', 'icon', 'detail', 'step']) if (node[key] !== undefined) result[key] = node[key];
  if (kind === 'class') { if (node.sublabel) result.sublabel = node.sublabel; result.kind = node.kind; }
  if (kind === 'erd' && node.tag) result.tag = node.tag;
  if (kind === 'lifecycle') result.kind = node.type;
  if (kind === 'waterfall' && node.parent) result.parent = idMap.get(node.parent);
  if (kind === 'timeline') result.kind = node.kind || 'default';
  return result;
}
function documentComment(data) {
  const value = { kind: data.diagram_type };
  for (const key of ['locale', 'timezone', 'unit', 'evidence']) if (data.meta[key]) value[key] = data.meta[key];
  if (data.meta.legend?.entries) value.legend = Object.fromEntries(Object.entries(data.meta.legend.entries).filter(([, entry]) => entry.label).map(([key, entry]) => [key, entry.label]));
  return `---\ntitle: ${JSON.stringify(data.meta.title)}\n---\n` + annotation('diagram', '', value);
}
function workflow(data, ids, groupId) {
  const lines = ['block', '  columns 1'], columns = Math.max(6, ...data.nodes.map(node => node.col + 1));
  const rootPhases = 'phases';
  if (data.phases?.length) {
    lines.push(`  block:${rootPhases}["Phases"]`, `    columns ${columns}`);
    let cursor = 0;
    for (const phase of data.phases) {
      if (phase.fromCol > cursor) lines.push(`    space:${phase.fromCol - cursor}`);
      if (phase.variant) lines.push(annotation('node', 'phase_' + phase.id, { variant: phase.variant }).trimEnd());
      lines.push(`    phase_${phase.id}[${quote(phase.label)}]:${phase.toCol - phase.fromCol + 1}`);
      cursor = phase.toCol + 1;
    }
    if (cursor < columns) lines.push(`    space:${columns - cursor}`);
    lines.push('  end');
  }
  const composites = [], lanes = [];
  for (const [index, lane] of data.lanes.entries()) {
    const id = groupId(lane.id, lane.label, `lane_${index}`); lanes.push(id); composites.push(id);
    lines.push(annotation('group', id, lane.variant ? { variant: lane.variant } : {}).trimEnd(), `  block:${id}[${quote(lane.label)}]`, `    columns ${columns}`);
    const members = data.nodes.filter(node => node.lane === lane.id), groups = (data.groups || []).filter(group => group.lane === lane.id);
    const entries = [...groups.map(group => ({ from: group.fromCol, to: group.toCol, group })), ...members.filter(node => !groups.some(group => node.col >= group.fromCol && node.col <= group.toCol)).map(node => ({ from: node.col, to: node.col, node }))].sort((a, b) => a.from - b.from);
    let cursor = 0;
    const emitNode = (node, indent) => {
      const id = ids.get(node.id);
      const attributes = extras(node, 'workflow', ids);
      if (data.mainPath?.includes(node.id)) attributes.main = true;
      if (Object.keys(attributes).length) lines.push(annotation('node', id, attributes).trimEnd());
      lines.push(`${indent}${id}${node.type === 'database' ? '([' : '['}${quote(label(node))}${node.type === 'database' ? '])' : ']'}`);
    };
    for (const entry of entries) {
      if (entry.from > cursor) lines.push(`    space:${entry.from - cursor}`);
      if (entry.group) {
        const group = entry.group, groupName = groupId(group.id, group.label, `workgroup_${group.id}`), span = group.toCol - group.fromCol + 1;
        composites.push(groupName);
        lines.push(annotation('group', groupName, group.variant ? { variant: group.variant } : {}).trimEnd(), `    block:${groupName}[${quote(group.label)}]:${span}`, `      columns ${span}`);
        let inner = group.fromCol;
        for (const node of members.filter(node => node.col >= group.fromCol && node.col <= group.toCol).sort((a, b) => a.col - b.col)) {
          if (node.col > inner) lines.push(`      space:${node.col - inner}`);
          emitNode(node, '      '); inner = node.col + 1;
        }
        if (inner <= group.toCol) lines.push(`      space:${group.toCol - inner + 1}`);
        lines.push('    end');
      } else emitNode(entry.node, '    ');
      cursor = entry.to + 1;
    }
    if (cursor < columns) lines.push(`    space:${columns - cursor}`);
    lines.push('  end');
  }
  for (const edge of data.edges) {
    const from = ids.get(edge.from), to = ids.get(edge.to), nativeId = `1-${from}-${to}`;
    const attributes = {};
    if (['security', 'return'].includes(edge.variant)) attributes.variant = edge.variant;
    if (edge.role) attributes.role = edge.role;
    if (Object.keys(attributes).length) lines.push(annotation('edge', nativeId, attributes).trimEnd());
    const arrow = edge.variant === 'emphasis' ? '==>' : ['security', 'dashed', 'return'].includes(edge.variant) ? '-.->' : '-->';
    lines.push(`  ${from}${edge.label ? ` -- ${quote(edge.label)} ${arrow}` : ` ${arrow}`} ${to}`);
  }
  for (const node of data.nodes) lines.push(`  class ${ids.get(node.id)} ccv-${node.type}`);
  if (data.phases?.length) { lines.push(`  class ${data.phases.map(phase => 'phase_' + phase.id).join(',')} ccv-phase`); composites.push(rootPhases); }
  lines.push(`  class ${composites.join(',')} ccv-layer`, `  class ${lanes.join(',')} ccv-swimlane`);
  return lines.join('\n') + '\n';
}
function sequence(data, ids, oldGraph) {
  let output = 'sequenceDiagram\n';
  for (const node of data.participants) {
    const id = ids.get(node.id), type = node.type === 'external' ? 'actor' : 'participant', shape = node.type === 'database' ? '@{ "type": "database" }' : node.type === 'messagebus' ? '@{ "type": "queue" }' : '';
    output += `  ${type} ${id}${shape} as ${label(node)}\n  properties ${id}: {"ccvRole":"${node.type}"}\n`;
    const attributes = extras(node, 'sequence', ids);
    if (Object.keys(attributes).length) output += annotation('node', id, attributes);
  }
  const oldMessages = [...oldGraph.elements.values()].filter(item => item.ref.startsWith('message:'));
  const events = [];
  for (const [i, segment] of (data.segments || []).entries()) { events.push({ at: segment.from, priority: 0, text: `  rect transparent\n  Note over ${ids.get(data.participants[0].id)},${ids.get(data.participants.at(-1).id)}: ${segment.label}\n` }); events.push({ at: segment.to, priority: 4, text: '  end\n' }); }
  for (const activation of data.activations || []) { events.push({ at: activation.from, priority: 1, text: `  activate ${ids.get(activation.participant)}\n` }); events.push({ at: activation.to, priority: 3, text: `  deactivate ${ids.get(activation.participant)}\n` }); }
  for (const [i, message] of data.messages.entries()) {
    const id = oldMessages[i]?.ref.slice(8) || `message-${i}`, arrow = message.variant === 'return' ? '-->>' : message.variant === 'dashed' ? '-)' : '->>';
    events.push({ at: message.y, priority: 2, text: `${['emphasis', 'security'].includes(message.variant) ? annotation('edge', id, { variant: message.variant }) : ''}  %% ccv:message ${id}\n  ${ids.get(message.from)}${arrow}${ids.get(message.to)}: ${message.label}\n` });
  }
  output += events.sort((a, b) => a.at - b.at || a.priority - b.priority).map(event => event.text).join('');
  return output;
}
function structured(data, ids) {
  const lines = [];
  if (data.diagram_type === 'erd') {
    lines.push('erDiagram', '  direction LR');
    for (const node of data.entities) {
      const id = ids.get(node.id); lines.push(annotation('node', id, extras(node, 'erd', ids)).trimEnd(), `  ${id}[${quote(node.label)}] {`);
      for (const field of node.attributes || []) {
        const keys = field.key ? (Array.isArray(field.key) ? field.key : [field.key]).map(key => key.toUpperCase()).join(',') : '';
        const detail = [field.references ? `references ${field.references}` : '', field.nullable ? 'nullable' : ''].filter(Boolean).join('; ');
        lines.push(`    ${field.type} ${field.name}${keys ? ' ' + keys : ''}${detail ? ' ' + quote(detail) : ''}`);
      }
      lines.push('  }');
    }
    for (const edge of data.relationships) {
      const from = edge.fromCardinality === 'many' ? edge.fromOptional ? '}o' : '}|' : edge.fromOptional ? '|o' : '||';
      const to = edge.toCardinality === 'many' ? edge.toOptional ? 'o{' : '|{' : edge.toOptional ? 'o|' : '||';
      lines.push(`  ${ids.get(edge.from)} ${from}${edge.identifying === false ? '..' : '--'}${to} ${ids.get(edge.to)} : ${quote(edge.label || ' ')}`);
    }
  } else if (data.diagram_type === 'class') {
    lines.push('classDiagram', '  direction TB');
    const visibility = { public: '+', private: '-', protected: '#', package: '~' };
    for (const node of data.types) {
      const id = ids.get(node.id); lines.push(annotation('node', id, extras(node, 'class', ids)).trimEnd(), `  class ${id}[${quote(node.label)}] {`);
      if (node.kind !== 'class') lines.push(`    <<${node.kind}>>`);
      const generics = value => String(value).replaceAll('<', '~').replaceAll('>', '~');
      for (const field of node.attributes || []) lines.push(`    ${visibility[field.visibility] || ''}${field.type ? generics(field.type) + ' ' : ''}${field.name}${field.static ? '$' : field.abstract ? '*' : ''}`);
      for (const method of node.methods || []) lines.push(`    ${visibility[method.visibility] || ''}${method.name}(${generics(method.parameters || '')})${method.static ? '$' : method.abstract ? '*' : ''}${method.returns ? ' ' + generics(method.returns) : ''}`);
      lines.push('  }');
    }
    const arrows = { dependency: '..>', association: '-->', inheritance: '--|>', realization: '..|>', composition: '*--', aggregation: 'o--' };
    for (const edge of data.relationships) lines.push(`  ${ids.get(edge.from)} ${arrows[edge.kind]} ${ids.get(edge.to)}${edge.label ? ' : ' + edge.label : ''}`);
  } else if (data.diagram_type === 'lifecycle') {
    lines.push('stateDiagram-v2', '  direction LR');
    for (const node of data.states) {
      const attributes = extras(node, 'lifecycle', ids); if (data.mainPath?.includes(node.id)) attributes.main = true;
      lines.push(annotation('node', ids.get(node.id), attributes).trimEnd(), `  state ${quote(label(node))} as ${ids.get(node.id)}`);
    }
    for (const [i, edge] of data.transitions.entries()) { if (edge.variant) lines.push(annotation('edge', `transition-${i}`, { variant: edge.variant }).trimEnd()); lines.push(`  ${ids.get(edge.from)} --> ${ids.get(edge.to)}${edge.label ? ': ' + edge.label : ''}`); }
  } else {
    const timeline = data.diagram_type === 'timeline';
    lines.push('gantt', `  dateFormat ${timeline ? 'YYYY-MM-DDTHH:mm:ssZ' : 'x'}`, `  axisFormat ${timeline ? '%m/%d %H:%M' : '%M:%S.%L'}`, '  todayMarker off');
    const sections = timeline ? data.lanes.map(lane => [lane.id, lane.label]) : [...new Set(data.spans.map(span => span.service))].map(service => [service, service]);
    for (const [id, caption] of sections) {
      lines.push(`  section ${caption}`);
      for (const node of timeline ? data.events.filter(event => event.lane === id) : data.spans.filter(span => span.service === id)) {
        const attributes = extras(node, data.diagram_type, ids); if (Object.keys(attributes).length) lines.push(annotation('node', ids.get(node.id), attributes).trimEnd());
        if (timeline) lines.push(`  ${node.title} :milestone, ${ids.get(node.id)}, ${node.at}, 0ms`);
        else lines.push(`  ${node.name} :${ids.get(node.id)}, ${node.start}, ${(node.end ?? node.start + node.duration) - node.start}ms`);
      }
    }
  }
  return lines.join('\n') + '\n';
}
let total = 0;
for (const entry of catalog.cases) {
  const file = 'examples/compare/' + entry.slug + '.md'; let markdown = fs.readFileSync(file, 'utf8');
  const models = compileDocument(markdown).diagrams;
  for (const [index, source] of entry.sources.entries()) {
    const data = JSON.parse(fs.readFileSync(path.join(root, source.file), 'utf8')), model = models[index], graph = (await parseMermaid(model)).graph;
    const originalNodes = data.components || data.nodes || data.participants || data.states || data.entities || data.types || data.events || data.spans;
    const oldNodes = [...graph.elements.values()].filter(item => /^(node|participant):/.test(item.ref));
    const ids = new Map(originalNodes.map(node => {
      const existing = oldNodes.find(item => item.ref.split(':')[1] === node.id || item.ref.split(':')[1] === 'n_' + node.id) || oldNodes.find(item => normalize(item.label.split(' · ')[0]) === normalize(node.label || node.title || node.name));
      return [node.id, existing?.ref.split(':')[1] || (/^(erd|class)$/.test(data.diagram_type) ? node.id : 'n_' + node.id)];
    }));
    const oldGroups = [...graph.elements.values()].filter(item => item.ref.startsWith('group:'));
    const assignedGroups = new Map();
    const groupId = (id, title, fallback) => {
      const key = id || fallback;
      if (assignedGroups.has(key)) return assignedGroups.get(key);
      const available = oldGroups.filter(item => ![...assignedGroups.values()].includes(item.ref.slice(6)));
      const existing = available.find(item => item.ref.slice(6) === id || item.ref.slice(6) === fallback) || available.find(item => normalize(item.label).includes(normalize(title)));
      const value = existing?.ref.slice(6) || fallback; assignedGroups.set(key, value); return value;
    };
    let sourceText;
    if (data.diagram_type === 'workflow') sourceText = workflow(data, ids, groupId);
    else if (data.diagram_type === 'sequence') sourceText = sequence(data, ids, graph);
    else if (['erd', 'class', 'lifecycle', 'timeline', 'waterfall'].includes(data.diagram_type)) sourceText = structured(data, ids);
    else {
      sourceText = model.source.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/^\s*%%\s*ccv:(?:diagram|node|edge|group)\s+.*\n/gm, '');
      for (const node of originalNodes) {
        const id = ids.get(node.id), own = graph.elements.get(`node:${id}`), shape = own?.shape === 'cylinder' ? ['[("', '")]'] : ['["', '"]'];
        const declaration = new RegExp('^(\\s*)' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\[|\\().*$', 'm');
        sourceText = sourceText.replace(declaration, (_, indent) => `${indent}${id}${shape[0]}${label(node)}${shape[1]}${node.type ? ':::ccv-' + node.type : ''}`);
      }
      const additions = [];
      for (const node of originalNodes) { const attributes = extras(node, data.diagram_type, ids); if (Object.keys(attributes).length) additions.push(annotation('node', ids.get(node.id), attributes)); }
      const oldEdges = [...graph.elements.values()].filter(item => item.ref.startsWith('edge:')), usedEdges = new Set();
      for (const edge of data.connections || data.flows || []) {
        const from = ids.get(edge.from), to = ids.get(edge.to), existing = oldEdges.find(item => !usedEdges.has(item.ref) && item.from === from && item.to === to);
        if (!existing) throw new Error(`Cannot map relationship ${edge.from} → ${edge.to} in ${file}`);
        usedEdges.add(existing.ref);
        const id = existing.ref.slice(5), arrow = edge.variant === 'emphasis' ? '==>' : ['dashed', 'return'].includes(edge.variant) ? '-.->' : '-->';
        const caption = [edge.label, edge.classification].filter(Boolean).join('<br/>');
        const declaration = new RegExp('^\\s*' + from + '\\s+' + id + '@.*$', 'm');
        if (!declaration.test(sourceText)) throw new Error(`Cannot locate native relationship ${id} in ${file}`);
        sourceText = sourceText.replace(declaration, `  ${from} ${id}@${arrow}${caption ? '|' + quote(caption) + '|' : ''} ${to}`);
        if (['security', 'return'].includes(edge.variant)) additions.push(annotation('edge', id, { variant: edge.variant }));
      }
      const usedBoundaries = new Set();
      for (const group of data.boundaries || []) {
        const members = new Set(group.wraps.map(id => ids.get(id)));
        const candidates = oldGroups.filter(item => !usedBoundaries.has(item.ref)).filter(item => {
          const children = oldNodes.filter(node => node.parents.includes(item.ref.slice(6)));
          return children.length === members.size && children.every(node => members.has(node.ref.slice(5)));
        });
        const existing = candidates.find(item => normalize(item.label) === normalize(group.label)) || candidates[0];
        if (!existing) throw new Error(`Cannot map boundary ${group.label} in ${file}`);
        usedBoundaries.add(existing.ref);
        additions.push(annotation('group', existing.ref.slice(6), { kind: group.kind }));
      }
      sourceText += '\n' + additions.join('');
    }
    sourceText = documentComment(data) + sourceText;
    const parsed = await parseMermaid({ ...model, type: data.diagram_type === 'workflow' ? 'block' : model.type, source: sourceText });
    const valid = new Set(parsed.graph.elements.keys());
    const remap = ref => {
      if (valid.has(ref)) return ref;
      const [family, id] = ref.split(':');
      const matches = [...parsed.graph.elements.values()].filter(item => item.ref.startsWith(family + ':') && normalize(item.label.split(/<br\s*\/?\s*>|\n| · /)[0]) === normalize(id));
      if (matches.length === 1) return matches[0].ref;
      throw new Error(`Cannot migrate reading reference ${ref} in ${file}`);
    };
    for (const step of model.steps) step.focus = step.focus.map(remap);
    const view = { version: 1, ...(model.overview ? { overview: model.overview } : {}), details: Object.fromEntries(Object.entries(model.details).filter(([ref]) => valid.has(ref))), ...(Object.keys(model.links).length ? { links: model.links } : {}), ...(model.steps.length ? { steps: model.steps } : {}) };
    const overview = model.overview || model.steps[0]?.ref || Object.keys(model.sections)[0];
    if (['workflow', 'sequence'].includes(data.diagram_type) && overview) for (const ref of valid) if (!view.details[ref]) view.details[ref] = overview;
    const pattern = new RegExp('(:::\\s+diagram\\s+id="' + model.id + '"[\\s\\S]*?```mermaid\\r?\\n)[\\s\\S]*?(```[\\s\\S]*?```diagram-view\\r?\\n)[\\s\\S]*?(```)');
    let replaced = false;
    markdown = markdown.replace(pattern, (_, prefix, middle, suffix) => { replaced = true; return prefix + sourceText + middle + stringify(view, { lineWidth: 0 }) + suffix; });
    if (!replaced) throw new Error('Cannot locate diagram container ' + model.id);
    total++;
  }
  fs.writeFileSync(file, markdown.replaceAll('\r\n', '\n'));
}
console.log(`Aligned native Mermaid definitions for ${total} official examples; no pixel coordinates or second graph files emitted.`);
