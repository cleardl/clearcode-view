import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadNavigation } from '../../src/integrations/vitepress/navigation.js';
import { clearcodeViewConfig } from '../../src/integrations/vitepress/config.js';

const roots: string[] = [];
function fixture(config: string): string {
  const root = mkdtempSync(join(tmpdir(), 'clearcode-view-navigation-'));
  roots.push(root);
  writeFileSync(join(root, 'clearcode.config.yaml'), config);
  writeFileSync(join(root, 'intro.md'), '# Intro\n');
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('text navigation', () => {
  it('uses canonical routes for root and nested index documents', () => {
    const root = fixture('version: 1\ntitle: Notes\nnavigation:\n - {label: Home, file: index.md}\n - {label: Guide, file: guide/index.md}\n');
    writeFileSync(join(root, 'index.md'), '# Home\n');
    mkdirSync(join(root, 'guide'));
    writeFileSync(join(root, 'guide/index.md'), '# Guide\n');
    expect(clearcodeViewConfig({ root }).themeConfig?.sidebar).toEqual([{ text: 'Home', link: '/' }, { text: 'Guide', link: '/guide/' }]);
  });
  it('loads nested navigation without requiring project/module/flow categories', () => {
    const root = fixture('version: 1\ntitle: Notes\nnavigation:\n - label: Problems\n   items:\n    - {label: Intro, file: intro.md}\n');
    expect(loadNavigation(root).documents.size).toBe(1);
  });
  it('rejects missing navigation targets', () => {
    const root = fixture('version: 1\ntitle: Notes\nnavigation:\n - {label: Missing, file: absent.md}\n');
    expect(() => loadNavigation(root)).toThrow(/文档不存在/);
  });
  it('rejects navigation outside its configured document root', () => {
    const root = fixture('version: 1\ntitle: Notes\nnavigation:\n - {label: Outside, file: ../outside.md}\n');
    expect(() => loadNavigation(root)).toThrow(/超出根目录/);
  });
  it('rejects a graph link to a missing document anchor', () => {
    const root = fixture('version: 1\ntitle: Notes\nnavigation:\n - {label: Intro, file: intro.md}\n');
    writeFileSync(join(root, 'target.md'), '# Target\n');
    writeFileSync(join(root, 'intro.md'), '::: diagram id="links"\n```mermaid\nflowchart TD\n A-->B\n```\n```diagram-view\nversion: 1\nlinks:\n "node:A": target.md#missing\n```\n:::\n');
    expect(() => loadNavigation(root)).toThrow(/关联文档锚点不存在/);
  });
});
