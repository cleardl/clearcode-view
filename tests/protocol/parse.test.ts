import { describe, expect, it } from 'vitest';
import { compileDocument } from '../../src/index.js';
import MarkdownIt from 'markdown-it';
import { clearcodeMarkdownPlugin } from '../../src/integrations/vitepress/markdown.js';

function fixture(metadata = 'version: 1\ndetails:\n  "node:gateway": "#gateway"', heading = '请求网关'): string {
  return `# 技术说明\n\n::: diagram id="request"\n\n\`\`\`mermaid\nflowchart LR\n client[Client] request@--> gateway[Gateway]\n\`\`\`\n\n\`\`\`diagram-view\n${metadata}\n\`\`\`\n\n:::\n\n## ${heading} {#gateway}\n\n接纳请求并确定**运行实例**。\n\n## 其他章节 {#other}\n\n不属于侧栏的内容。\n`;
}

function sidebarFixture(): string {
  return fixture().replace('## 请求网关', '::: diagram-details\n\n## 请求网关').replace('## 其他章节', ':::\n\n## 其他章节');
}

describe('Markdown reading model', () => {
  it('uses authored sections and stable anchors when heading labels change', () => {
    const first = compileDocument(fixture()).diagrams[0];
    const renamed = compileDocument(fixture(undefined, '请求接纳')).diagrams[0];
    expect(first.sections['#gateway'].html).toContain('<strong>运行实例</strong>');
    expect(renamed.sections['#gateway'].title).toBe('请求接纳');
    expect(Object.keys(first.sections)).toEqual(['#gateway']);
    expect(first.source).toContain('request@-->');
  });

  it('keeps multiple diagrams independent and ignores Mermaid examples inside code fences', () => {
    const source = fixture() + '\n```mermaid\nsequenceDiagram\n A->>B: hello\n```\n\n````markdown\n```mermaid\ninvalid example\n```\n````\n';
    const document = compileDocument(source);
    expect(document.diagrams.map(graph => graph.type)).toEqual(['flowchart', 'sequence']);
    expect(document.blocks[0].start).toBe(2);
    expect(document.blocks[0].end).toBeGreaterThan(10);
  });

  it('escapes authored HTML and excludes event attributes from sidebar Markdown', () => {
    const source = fixture().replace('接纳请求并确定**运行实例**。', '<img src=x onerror=alert(1)>\n\n![image](image.png){onerror=alert(1)}');
    const html = compileDocument(source).diagrams[0].sections['#gateway'].html;
    expect(html).toContain('&lt;img');
    expect(html).not.toMatch(/<img[^>]+onerror=/);
  });

  it('does not require steps, packets or field mappings', () => {
    const graph = compileDocument(fixture()).diagrams[0];
    expect(graph.steps).toEqual([]);
    expect(graph.links).toEqual({});
  });

  it('loads a static overview from the same Markdown without adding reading steps', () => {
    const graph = compileDocument(fixture('version: 1\noverview: "#gateway"')).diagrams[0];
    expect(graph.overview).toBe('#gateway');
    expect(graph.sections['#gateway'].title).toBe('请求网关');
    expect(graph.steps).toEqual([]);
    expect(graph.details).toEqual({});
  });

  it.each([
    ['unknown protocol version', 'version: 2', /version/],
    ['duplicate YAML key', 'version: 1\nversion: 1', /unique|重复/i],
    ['unknown metadata field', 'version: 1\nnodes: []', /nodes|Unrecognized/],
    ['missing prose anchor', 'version: 1\ndetails:\n  "node:gateway": "#missing"', /#missing/],
    ['missing overview anchor', 'version: 1\noverview: "#missing"', /#missing/],
    ['wrong graph selector kind', 'version: 1\ndetails:\n  "participant:gateway": "#gateway"', /不支持/],
    ['duplicate step ID', 'version: 1\nsteps:\n - {id: one, title: 一, focus: ["node:gateway"]}\n - {id: one, title: 二, focus: ["node:client"]}', /重复步骤/],
    ['script document link', 'version: 1\nlinks:\n  "node:gateway": "javascript:alert(1)"', /相对路径/],
  ])('reports %s with file and source location', (_label, metadata, pattern) => {
    expect(() => compileDocument(fixture(metadata), { file: 'notes/request.md' })).toThrow(pattern);
    expect(() => compileDocument(fixture(metadata), { file: 'notes/request.md' })).toThrow(/notes\/request.md:\d+/);
  });

  it('rejects repeated diagram IDs', () => {
    expect(() => compileDocument(fixture() + '\n::: diagram id="request"\n```mermaid\nflowchart TD\n A-->B\n```\n:::\n')).toThrow(/重复图 ID/);
  });

  it('rejects standalone interaction declarations', () => {
    expect(() => compileDocument('```diagram-view\nversion: 1\n```\n')).toThrow(/必须位于/);
  });

  it('consumes the closing delimiter when used inside a host Markdown parser', () => {
    const md = new MarkdownIt({ html: true }).use(clearcodeMarkdownPlugin);
    const html = md.render(fixture(), { path: 'architecture.md' });
    expect(html).toContain('<ClearcodeDiagram');
    expect(html).not.toContain('<p>:::</p>');
    expect(html).toContain('请求网关');
    expect(html).not.toContain('<pre><code class="language-diagram-view">');
  });

  it('recompiles a changed document even when the host reuses its environment', () => {
    const md = new MarkdownIt({ html: true }).use(clearcodeMarkdownPlugin), env = { path: 'architecture.md' };
    expect(md.render(fixture(), env)).toContain('请求网关');
    expect(md.render(fixture(undefined, '重命名后的职责'), env)).toContain('重命名后的职责');
  });

  it('keeps sidebar-only prose in the model and consumes it from the host body', () => {
    const source = sidebarFixture(), document = compileDocument(source);
    expect(document.diagrams[0].sections['#gateway'].html).toContain('<strong>运行实例</strong>');
    expect(document.readingBlocks).toHaveLength(1);
    expect(document.readingBlocks[0].anchors).toEqual([{ id: 'gateway', diagram: 'request', ref: '#gateway' }]);
    const md = new MarkdownIt({ html: true }).use(clearcodeMarkdownPlugin);
    const html = md.render(source, { path: 'architecture.md' });
    expect(html).toContain('data-ccv-reading-ref="#gateway" hidden');
    expect(html).not.toContain('<h2>请求网关');
    expect(html).not.toContain('<p>接纳请求');
    expect(html).toContain('<h2>其他章节');
    expect(html).toContain('<p>不属于侧栏的内容。</p>');
    expect(html).not.toContain('<p>:::</p>');
  });

  it('ends sidebar-only prose at the container even before a lower heading', () => {
    const source = sidebarFixture().replace('## 其他章节', '### 其他章节');
    const graph = compileDocument(source).diagrams[0];
    expect(graph.sections['#gateway'].html).not.toContain('不属于侧栏');
  });

  it('routes nested heading anchors to the explanation that contains them', () => {
    const source = sidebarFixture().replace('接纳请求并确定**运行实例**。', '接纳请求。\n\n### 实例分配 {#allocation}\n\n确定运行实例。');
    const document = compileDocument(source);
    expect(document.readingBlocks[0].anchors).toEqual([
      { id: 'gateway', diagram: 'request', ref: '#gateway' },
      { id: 'allocation', diagram: 'request', ref: '#gateway' },
    ]);
    expect(document.diagrams[0].sections['#gateway'].html).toContain('确定运行实例');
  });

  it('preserves packets and code in sidebar-only content', () => {
    const source = sidebarFixture().replace('接纳请求并确定**运行实例**。', '```json\n{"accepted":true}\n```\n\n```ts\nconnect();\n```');
    const html = compileDocument(source).diagrams[0].sections['#gateway'].html;
    expect(html).toContain('language-json');
    expect(html).toContain('language-ts');
    expect(html).not.toContain('container_diagram');
  });

  it('reports sidebar-only content without a reading association instead of discarding it', () => {
    expect(() => compileDocument(sidebarFixture().replace('"node:gateway": "#gateway"', '"node:gateway": "#other"'), { file: 'notes.md' })).toThrow(/notes.md:\d+.*侧栏专用章节没有被图/);
  });

  it('requires an opening heading and a closing sidebar-only delimiter', () => {
    expect(() => compileDocument(sidebarFixture().replace('::: diagram-details', '::: diagram-details\n\n没有标题的内容。'))).toThrow(/须以可引用的标题开始/);
    expect(() => compileDocument(sidebarFixture().replace(':::\n\n## 其他章节', '## 其他章节'))).toThrow(/diagram-details 容器缺少结束标记/);
  });

  it('does not interpret sidebar-only syntax inside a fenced Markdown example', () => {
    const source = fixture() + '\n````markdown\n::: diagram-details\n## example\n:::\n````\n';
    expect(compileDocument(source).readingBlocks).toEqual([]);
    expect(new MarkdownIt().use(clearcodeMarkdownPlugin).render(source)).toContain('::: diagram-details');
  });

  it('reports an unclosed enhanced diagram instead of swallowing following content', () => {
    expect(() => compileDocument('::: diagram id="open"\n```mermaid\nflowchart TD\n A-->B\n```\n')).toThrow(/结束标记/);
  });
});
