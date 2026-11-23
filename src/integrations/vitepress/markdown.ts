import { compileDocument, type CompiledMarkdown } from '../../protocol/parse.js';

/** The adapter uses only the public Markdown-it block rule interface. */
interface BlockState {
  src: string;
  env: Record<string, unknown>;
  line: number;
  push(type: string, tag: string, nesting: 0): { content: string; map: [number, number] | null };
}

/** A minimal interface accommodates both ESM and CJS Markdown-it declarations. */
export interface MarkdownHost {
  block: { ruler: { before(name: string, ruleName: string, rule: (state: BlockState, start: number, end: number, silent: boolean) => boolean): void } };
}

/** Local Markdown links remain navigable in generated HTML and sidebars. */
export function htmlDocumentLink(href: string): string { return href.replace(/\.md(?=#|$)/, '.html'); }

function attribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}

/** Replace diagrams and consume sidebar-only prose before the host renders text. */
export function clearcodeMarkdownPlugin(md: MarkdownHost): void {
  const cache = new WeakMap<object, { source: string; compiled: CompiledMarkdown }>();
  md.block.ruler.before('fence', 'clearcode-view', (state, start, _end, silent) => {
    let entry = cache.get(state.env);
    if (!entry || entry.source !== state.src) {
      const file = typeof state.env.path === 'string' ? state.env.path : typeof state.env.relativePath === 'string' ? state.env.relativePath : 'document.md';
      entry = { source: state.src, compiled: compileDocument(state.src, { file, link: htmlDocumentLink }) };
      cache.set(state.env, entry);
    }
    const block = entry.compiled.blocks.find(candidate => candidate.start === start);
    const reading = entry.compiled.readingBlocks.find(candidate => candidate.start === start);
    if (!block && !reading) return false;
    if (silent) return true;
    const component = state.push('html_block', '', 0);
    component.content = block ? `<ClearcodeDiagram :model="${attribute(JSON.stringify(block.model))}" />\n`
      : reading!.anchors.map(anchor => `<span id="${attribute(anchor.id)}" data-ccv-reading-diagram="${attribute(anchor.diagram)}" data-ccv-reading-ref="${attribute(anchor.ref)}" hidden></span>\n`).join('');
    component.map = [start, block?.end ?? reading!.end];
    state.line = component.map[1];
    return true;
  });
}
