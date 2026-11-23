/** Semantic references are scoped to one diagram instance. */
export type ElementRef = `${'node' | 'edge' | 'group' | 'participant' | 'message'}:${string}`;

/** Diagram families with supported semantic interaction adapters. */
export type DiagramKind = 'flowchart' | 'block' | 'sequence' | 'other';

/** A location in a text source; lines are one-based. */
export interface SourceLocation { file: string; line: number; diagram?: string }

/** Lossless Mermaid input, independent of prose, navigation and presentation. */
export interface MermaidSource { source: string; type: DiagramKind; location: SourceLocation }

/** Reading HTML is sanitized by the input adapter or supplied by a trusted host. */
export interface ReadingSection { ref: string; title: string; html: string }

/** A reading step changes focus without changing collapse or camera state. */
export interface ReadingStep { id: string; title: string; focus: ElementRef[]; ref?: string }

/** Diagram content and optional reading associations shared by all document hosts. */
export interface DiagramModel extends MermaidSource {
  id: string;
  overview?: string;
  details: Partial<Record<ElementRef, string>>;
  links: Partial<Record<ElementRef, string>>;
  steps: ReadingStep[];
  sections: Record<string, ReadingSection>;
}

/** Structured content failures retain their text-source location. */
export class DocumentError extends Error {
  constructor(public readonly location: SourceLocation, detail: string) {
    super(`${location.file}:${location.line}${location.diagram ? ` [${location.diagram}]` : ''}: ${detail}`);
    this.name = 'DocumentError';
  }
}
