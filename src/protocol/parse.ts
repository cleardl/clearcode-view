import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import anchor from 'markdown-it-anchor';
import attributes from 'markdown-it-attrs';
import type Token from 'markdown-it/lib/token.mjs';
import { DocumentError, type CompiledDocument, type DiagramModel, type ReadingSection } from './model.js';
import { readView } from './validate.js';
import { createDiagram } from '../core/diagram.js';

export { diagramType } from '../core/diagram.js';

/** Inputs to the framework-independent Markdown compiler. */
export interface CompileOptions { file?: string; link?: (href: string) => string }

/** Source ranges let a host replace only graph blocks with components. */
export interface DiagramBlock { start: number; end: number; model: DiagramModel }

/** Sidebar-only prose remains available to diagrams and authored deep links. */
export interface ReadingBlock {
  start: number;
  end: number;
  anchors: { id: string; diagram: string; ref: string }[];
}

/** Source ranges distinguish diagrams, sidebar-only prose and ordinary text. */
export interface CompiledMarkdown extends CompiledDocument { blocks: DiagramBlock[]; readingBlocks: ReadingBlock[] }

interface ReadingContainer { start: number; end: number; first: number; last: number }

function createParser(): MarkdownIt {
  return new MarkdownIt({ html: false, linkify: true })
    .use(attributes, { allowedAttributes: ['id', 'class'] })
    .use(anchor)
    .use(container, 'diagram', { validate: (info: string) => /^diagram(?:\s|$)/.test(info.trim()) })
    .use(container, 'diagram-details', { validate: (info: string) => info.trim() === 'diagram-details', render: () => '' });
}

function headingText(token: Token): string {
  return token.children?.filter(child => ['text', 'code_inline', 'image'].includes(child.type)).map(child => child.content).join('') || token.content;
}

function collectSections(tokens: Token[], md: MarkdownIt, link: (href: string) => string, file: string, containers: ReadingContainer[]) {
  const headings = tokens.flatMap((token, index) => token.type === 'heading_open' ? [{
    index, level: Number(token.tag.slice(1)), id: token.attrGet('id') || '', title: headingText(tokens[index + 1]),
  }] : []);
  const sections: Record<string, ReadingSection> = {};
  const rewrite = (token: Token) => {
    if (token.type === 'link_open') { const href = token.attrGet('href'); if (href) token.attrSet('href', link(href)); }
    token.children?.forEach(rewrite);
  };
  tokens.forEach(token => {
    rewrite(token);
    if (token.type === 'heading_open') token.attrs = token.attrs?.filter(([key]) => key !== 'id') || null;
  });
  for (const heading of headings) {
    const ref = '#' + heading.id;
    if (sections[ref]) throw new DocumentError({ file, line: (tokens[heading.index].map?.[0] || 0) + 1 }, `重复正文锚点：${ref}`);
    const next = headings.find(other => other.index > heading.index && other.level <= heading.level);
    const parent = containers.find(block => heading.index > block.first && heading.index < block.last);
    const end = Math.min(next?.index ?? tokens.length, parent?.last ?? tokens.length);
    sections[ref] = { ref, title: heading.title, html: md.renderer.render(tokens.slice(heading.index + 3, end), md.options, {}) };
  }
  return { sections, headings };
}

/** Compile authored Markdown and linked explanation sections without DOM or Vue. */
export function compileDocument(source: string, { file = 'document.md', link = href => href }: CompileOptions = {}): CompiledMarkdown {
  const md = createParser(), tokens = md.parse(source, {});
  const sourceLines = source.split(/\r?\n/);
  const containers: ReadingContainer[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'container_diagram-details_open') continue;
    const location = { file, line: (token.map?.[0] || 0) + 1 };
    const closingLine = token.map?.[1];
    if (closingLine === undefined || !/^\s*:{3,}\s*$/.test(sourceLines[closingLine] || '')) throw new DocumentError(location, 'diagram-details 容器缺少结束标记 :::');
    const last = tokens.findIndex((child, childIndex) => childIndex > index && child.type === 'container_diagram-details_close');
    if (last < 0 || tokens.slice(index + 1, last).some(child => child.type === 'container_diagram-details_open')) throw new DocumentError(location, 'diagram-details 容器不能嵌套');
    if (tokens[index + 1]?.type !== 'heading_open') throw new DocumentError(location, 'diagram-details 内容须以可引用的标题开始');
    containers.push({ start: token.map![0], end: closingLine + 1, first: index, last });
  }
  const { sections, headings } = collectSections(tokens, md, link, file, containers);
  const blocks: DiagramBlock[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    let end = index, id: string, mermaid: Token | undefined, view: Token | undefined;
    if (token.type === 'container_diagram_open') {
      const match = /^diagram\s+id="([A-Za-z][A-Za-z0-9_-]*)"\s*$/.exec(token.info.trim());
      if (!match) throw new DocumentError({ file, line: (token.map?.[0] || 0) + 1 }, '容器需要 ::: diagram id="稳定ID"');
      id = match[1];
      for (end = index + 1; end < tokens.length && tokens[end].type !== 'container_diagram_close'; end++) {
        const child = tokens[end];
        if (child.type !== 'fence' || !['mermaid', 'diagram-view'].includes(child.info.trim())) throw new DocumentError({ file, line: (child.map?.[0] || 0) + 1, diagram: id }, 'diagram 容器内只支持 Mermaid 和 diagram-view 围栏');
        if (child.info.trim() === 'mermaid') {
          if (mermaid) throw new DocumentError({ file, line: (child.map?.[0] || 0) + 1, diagram: id }, '一个图只能有一个 Mermaid 围栏');
          mermaid = child;
        } else {
          if (view) throw new DocumentError({ file, line: (child.map?.[0] || 0) + 1, diagram: id }, '一个图只能有一个 diagram-view 围栏');
          view = child;
        }
      }
      if (!mermaid || end === tokens.length) throw new DocumentError({ file, line: (token.map?.[0] || 0) + 1, diagram: id }, '图容器缺少 Mermaid 或结束标记');
    } else if (token.type === 'fence' && token.info.trim() === 'mermaid') {
      id = `mermaid-${(token.map?.[0] || 0) + 1}`;
      mermaid = token;
    } else if (token.type === 'fence' && token.info.trim() === 'diagram-view') {
      throw new DocumentError({ file, line: (token.map?.[0] || 0) + 1 }, 'diagram-view 必须位于 diagram 容器内');
    } else continue;

    const location = { file, line: (token.map?.[0] || 0) + 1, diagram: id };
    if (!mermaid) throw new DocumentError(location, '图容器缺少 Mermaid 围栏');
    if (ids.has(id)) throw new DocumentError(location, `重复图 ID：${id}`);
    ids.add(id);
    const config = view ? readView(view.content, { ...location, line: (view.map?.[0] || 0) + 2 }) : { details: {}, links: {}, steps: [] };
    const graphSource = mermaid.content;
    const usedRefs = new Set([('overview' in config ? config.overview : undefined), ...Object.values(config.details), ...config.steps.map(step => step.ref)].filter((ref): ref is string => typeof ref === 'string' && !!ref));
    const readingSections = Object.fromEntries([...usedRefs].filter(ref => sections[ref]).map(ref => [ref, sections[ref]]));
    const model = createDiagram({ id, source: graphSource, ...config, sections: readingSections, location });
    const startLine = token.map?.[0] || 0;
    let endLine = mermaid.map?.[1];
    if (token.type === 'container_diagram_open') {
      const closingLine = token.map?.[1];
      if (closingLine === undefined || !/^\s*:{3,}\s*$/.test(sourceLines[closingLine] || '')) throw new DocumentError(location, 'diagram 容器缺少结束标记 :::');
      endLine = closingLine + 1;
    }
    blocks.push({ start: startLine, end: endLine ?? startLine + 1, model });
    index = end;
  }
  const readingBlocks = containers.map(container => {
    const location = { file, line: container.start + 1 };
    if (blocks.some(block => block.start >= container.start && block.start < container.end)) throw new DocumentError(location, 'diagram-details 内只放解读正文，图定义须放在容器外');
    const local = headings.filter(heading => heading.index > container.first && heading.index < container.last);
    const anchors = local.map(heading => {
      const parents = local.filter(candidate => candidate.index <= heading.index && !local.some(next => next.index > candidate.index && next.index <= heading.index && next.level <= candidate.level)).reverse();
      for (const parent of parents) {
        const ref = '#' + parent.id;
        const owner = blocks.find(block => block.model.sections[ref]);
        if (owner) return { id: heading.id, diagram: owner.model.id, ref };
      }
      throw new DocumentError({ file, line: (tokens[heading.index].map?.[0] || 0) + 1 }, `侧栏专用章节没有被图的 overview、details 或 steps 引用：#${heading.id}`);
    });
    return { start: container.start, end: container.end, anchors };
  });
  return { file, diagrams: blocks.map(block => block.model), anchors: Object.keys(sections).map(ref => ref.slice(1)), blocks, readingBlocks };
}
