import type { ArchifyDocument, ArchifyKind, ArchifyOutput } from './model.js';

const loaders = {
  architecture: () => import('./upstream/architecture/render-architecture.mjs'),
  workflow: () => import('./upstream/workflow/render-workflow.mjs'),
  sequence: () => import('./upstream/sequence/render-sequence.mjs'),
  dataflow: () => import('./upstream/dataflow/render-dataflow.mjs'),
  lifecycle: () => import('./upstream/lifecycle/render-lifecycle.mjs'),
  erd: () => import('./upstream/erd/render-erd.mjs'),
  class: () => import('./upstream/class/render-class.mjs'),
  tree: () => import('./upstream/tree/render-tree.mjs'),
  timeline: () => import('./upstream/timeline/render-timeline.mjs'),
  waterfall: () => import('./upstream/waterfall/render-waterfall.mjs'),
} satisfies Record<ArchifyKind, () => Promise<{ render(input: ArchifyDocument): ArchifyOutput }>>;

/** Lazy-load the actual pinned type-specific renderer; input always comes from Mermaid. */
export async function drawArchify(document: ArchifyDocument): Promise<ArchifyOutput> {
  const module = await loaders[document.diagram_type]();
  return module.render(document);
}
