import { describe, expect, it, vi } from 'vitest';

vi.mock('markdown-it', () => { throw new Error('core imported Markdown'); });
vi.mock('vue', () => { throw new Error('core imported Vue'); });
vi.mock('mermaid', () => { throw new Error('core imported Mermaid runtime'); });
vi.mock('yaml', () => { throw new Error('core imported YAML'); });
vi.mock('zod', () => { throw new Error('core imported protocol schema'); });

describe('document-independent diagram content', () => {
  it('creates an interactive content model in Node without document or UI dependencies', async () => {
    const { createDiagram } = await import('../../src/core.js');
    const model = createDiagram({ id: 'request', source: 'flowchart LR\nA[Client] submit@--> B[Gateway]', details: { 'node:B': '#gateway' }, sections: { '#gateway': { ref: '#gateway', title: 'Gateway', html: '<p>Accepts requests.</p>' } } });
    expect(model.type).toBe('flowchart');
    expect(model.details['node:B']).toBe('#gateway');
    expect(model.steps).toEqual([]);
    expect(model.location.file).toBe('diagram.mmd');
    expect(model).not.toHaveProperty('theme');
    expect(model).not.toHaveProperty('renderer');
  });

  it('reports unresolved reading content at the direct text source', async () => {
    const { createDiagram } = await import('../../src/core.js');
    expect(() => createDiagram({ id: 'request', source: 'flowchart LR\nA-->B', overview: '#missing', location: { file: 'request.mmd', line: 4 } })).toThrow(/request\.mmd:4.*#missing/);
  });
});
