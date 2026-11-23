import type { DiagramModel } from '../core/model.js';

export { DocumentError, type ElementRef, type SourceLocation, type ReadingSection, type ReadingStep, type DiagramModel } from '../core/model.js';

/** Compiled documents retain authored anchors for cross-document validation. */
export interface CompiledDocument { file: string; diagrams: DiagramModel[]; anchors: string[] }
