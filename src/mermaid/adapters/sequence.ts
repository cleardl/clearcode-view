import type { Mermaid } from 'mermaid';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { Message } from 'mermaid/dist/diagrams/sequence/types.js';
import { DocumentError, type MermaidSource, type ElementRef } from '../../core/model.js';
import type { GraphMetadata } from '../model.js';

const annotation = /^\s*%%\s+ccv:message\s+([A-Za-z][A-Za-z0-9_-]*)\s*$/;

/** Restore footer identities from native actor names and their lifeline columns. */
export function annotateSequenceFooters(svg: SVGSVGElement, metadata: GraphMetadata): void {
  const columns = [...svg.querySelectorAll<SVGLineElement>('[data-et="life-line"][data-id]')]
    .map(line => ({ id: line.getAttribute('data-id')!, x: Number(line.getAttribute('x1')) }));
  const visited = new Set<SVGElement>();
  for (const glyph of svg.querySelectorAll<SVGElement>('.actor-bottom')) {
    const ownsLabel = glyph.localName === 'g' && (glyph.hasAttribute('name') || glyph.querySelector('text, foreignObject'));
    const owner = ownsLabel ? glyph : glyph.parentElement;
    if (!(owner instanceof SVGElement) || visited.has(owner)) continue;
    visited.add(owner);
    let id = glyph.getAttribute('name') || owner.getAttribute('data-id');
    if (!id) {
      // Mermaid 12.3 leaves database and queue footers unnamed, in the native column.
      const box = (owner as SVGGraphicsElement).getBBox();
      const matches = columns.filter(column => Math.abs(column.x - box.x - box.width / 2) < 1);
      if (matches.length === 1) id = matches[0].id;
    }
    const participant = id && metadata.elements.get(`participant:${id}`);
    if (!participant) throw new Error('Mermaid 底部参与者与生命线未能对应');
    owner.setAttribute('data-et', 'participant');
    owner.setAttribute('data-id', participant.dataId);
    owner.setAttribute('data-type', participant.shape || 'participant');
    owner.classList.add('ccv-sequence-footer');
  }
}

function signature(message: Message): string {
  return JSON.stringify([message.from, message.to, message.type, message.message]);
}

/** Use parser-only note markers to associate comments with native semantic records. */
export async function sequenceMetadata(engine: Mermaid, model: MermaidSource, db: SequenceDB): Promise<GraphMetadata> {
  const elements: GraphMetadata['elements'] = new Map();
  const actors = [...db.getActors()];
  const original = db.getMessages().map(message => ({ ...message }));
  for (const [id, actor] of actors) {
    const ref: ElementRef = `participant:${id}`;
    elements.set(ref, { ref, label: actor.description, dataId: id, parents: [], role: typeof actor.properties?.ccvRole === 'string' ? actor.properties.ccvRole : undefined, shape: actor.type });
  }
  const ids = new Set<string>();
  const lines = model.source.split(/\r?\n/);
  const markers = new Map<number, string>();
  for (const [index, line] of lines.entries()) {
    if (!/^\s*%%\s+ccv:message\b/.test(line)) continue;
    const match = annotation.exec(line);
    if (!match) throw new DocumentError(model.location, `无效消息注解：${line.trim()}`);
    if (ids.has(match[1])) throw new DocumentError(model.location, `重复消息 ID：${match[1]}`);
    ids.add(match[1]); markers.set(index, match[1]);
    const next = lines.slice(index + 1).find(value => value.trim());
    if (!next || /^\s*%%/.test(next)) throw new DocumentError(model.location, `消息注解 ${match[1]} 必须紧邻消息语句`);
  }
  if (!markers.size) return { type: 'sequence', elements, groups: [] };

  let actor = 'ccvAnnotation';
  while (db.getActors().has(actor)) actor += 'X';
  const prefix = actor + '_';
  // Only this parsing pass receives marker notes. The rendered source stays intact.
  const marked = lines.map((line, index) => markers.has(index) ? `Note over ${actor}: ${prefix}${markers.get(index)}` : line).join('\n')
    .replace(/^(\s*sequenceDiagram[^\n]*)(?:\n|$)/m, `$1\nparticipant ${actor}\n`);
  const parsed = await engine.mermaidAPI.getDiagramFromText(marked);
  if (!('getMessages' in parsed.db)) throw new DocumentError(model.location, 'Mermaid 时序解析接口不兼容');
  const markedDb = parsed.db as SequenceDB;
  let position = 0, pending: string | undefined;
  for (const message of markedDb.getMessages()) {
    if (message.type === markedDb.LINETYPE.NOTE && message.from === actor && typeof message.message === 'string' && message.message.startsWith(prefix)) {
      if (pending) throw new DocumentError(model.location, `消息注解 ${pending} 未绑定消息`);
      pending = message.message.slice(prefix.length); continue;
    }
    const native = original[position++];
    if (!native || signature(native) !== signature(message)) throw new DocumentError(model.location, '消息注解与 Mermaid 语义记录未能对应');
    if (!pending) continue;
    if (!native.from || !native.to || native.type === markedDb.LINETYPE.NOTE || native.type === markedDb.LINETYPE.ACTIVE_START || native.type === markedDb.LINETYPE.ACTIVE_END) throw new DocumentError(model.location, `消息注解 ${pending} 指向了非消息语句`);
    const ref: ElementRef = `message:${pending}`;
    elements.set(ref, { ref, label: typeof native.message === 'string' ? native.message : pending, dataId: 'i' + native.id, parents: [], from: native.from, to: native.to });
    pending = undefined;
  }
  if (pending || position !== original.length) throw new DocumentError(model.location, '消息注解未完整对应原始时序图');
  return { type: 'sequence', elements, groups: [] };
}
