import { DocumentError, type DiagramModel } from './model.js';
import type { DiagramGraph } from './graph.js';

/** Validate reading references without importing a document parser or renderer. */
export function validateDiagram(model: DiagramModel): void {
  const ids = new Set<string>();
  const kinds = model.type === 'flowchart' || model.type === 'block' ? ['node', 'edge', 'group'] : model.type === 'sequence' ? ['participant', 'message'] : [];
  const refs = [...Object.keys(model.details), ...Object.keys(model.links), ...model.steps.flatMap(step => step.focus)];
  for (const value of refs) if (!kinds.includes(value.split(':')[0])) throw new DocumentError(model.location, `${model.type} 不支持 ${value}`);
  const sections = [model.overview, ...Object.values(model.details), ...model.steps.map(step => step.ref)].filter((ref): ref is string => ref !== undefined);
  for (const ref of sections) if (!model.sections[ref]) throw new DocumentError(model.location, `正文锚点不存在：${ref}`);
  for (const step of model.steps) {
    if (ids.has(step.id)) throw new DocumentError(model.location, `重复步骤 ID：${step.id}`);
    ids.add(step.id);
  }
}

/** Resolve authored focus and reading associations against parsed Mermaid semantics. */
export function validateGraphReferences(model: DiagramModel, graph: DiagramGraph): void {
  const refs = [...Object.keys(model.details), ...Object.keys(model.links), ...model.steps.flatMap(step => step.focus)];
  const known = new Set<string>(graph.elements.keys());
  for (const ref of refs) if (!known.has(ref)) throw new DocumentError(model.location, `图元素不存在：${ref}`);
}
