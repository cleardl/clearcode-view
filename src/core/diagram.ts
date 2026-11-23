import { DocumentError, type DiagramModel, type DiagramKind, type SourceLocation } from './model.js';
import { validateDiagram } from './validate.js';

/** Classify routing only; Mermaid remains the syntax parser. */
export function diagramType(source: string): DiagramKind {
  const body = source.replace(/^\s*---\s*\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, '').split(/\r?\n/).filter(line => !/^\s*%%/.test(line)).join('\n').trim();
  if (/^(?:flowchart|graph)\b/.test(body)) return 'flowchart';
  if (/^block(?:-beta)?\b/.test(body)) return 'block';
  if (/^sequenceDiagram\b/.test(body)) return 'sequence';
  return 'other';
}

/** A host can supply Mermaid and reading content without a Markdown document. */
export type DiagramInput = Pick<DiagramModel, 'id' | 'source'> & Partial<Pick<DiagramModel, 'overview' | 'details' | 'links' | 'steps' | 'sections'>> & { location?: SourceLocation };

/** Create the same validated component model used by the Markdown adapter. */
export function createDiagram(input: DiagramInput): DiagramModel {
  const location = input.location || { file: 'diagram.mmd', line: 1, diagram: input.id };
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(input.id)) throw new DocumentError(location, '图 ID 需要以字母开头的稳定 ID');
  const model: DiagramModel = { ...input, type: diagramType(input.source), location, details: input.details || {}, links: input.links || {}, steps: input.steps || [], sections: input.sections || {} };
  validateDiagram(model);
  return model;
}
