import type { DefaultTheme, UserConfig } from 'vitepress';
import { loadNavigation, type NavigationItem } from './navigation.js';
import { clearcodeMarkdownPlugin } from './markdown.js';
import { resolve } from 'node:path';

/** Site-level integration options; document content remains in text files. */
export interface ClearcodeSiteOptions { root: string; config?: string }

function sidebar(items: NavigationItem[]): DefaultTheme.SidebarItem[] {
  return items.map(item => 'file' in item ? { text: item.label, link: '/' + item.file.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '') } : { text: item.label, collapsed: false, items: sidebar(item.items) });
}

/** Supply VitePress navigation, Markdown extension and a wide diagram page class. */
export function clearcodeViewConfig(options: ClearcodeSiteOptions): UserConfig {
  const project = loadNavigation(options.root, options.config);
  return {
    title: project.title,
    lang: 'zh-CN',
    lastUpdated: false,
    themeConfig: { sidebar: sidebar(project.navigation), outline: false },
    markdown: { config(md) { md.use(clearcodeMarkdownPlugin); } },
    vite: {
      ssr: { noExternal: ['clearcode-view'] },
      plugins: [{
        name: 'clearcode-view-navigation',
        configureServer(server) {
          const configPath = resolve(options.root, options.config || 'clearcode.config.yaml');
          server.watcher.add(configPath);
          const onChange = async (path: string) => {
            if (resolve(path) !== configPath) return;
            try { loadNavigation(options.root, options.config); await server.restart(); }
            catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              server.config.logger.error(message);
              server.ws.send({ type: 'error', err: { message, stack: '', id: configPath } });
            }
          };
          server.watcher.on('change', onChange);
          server.httpServer?.once('close', () => server.watcher.off('change', onChange));
        },
      }],
    },
    transformPageData(pageData) {
      pageData.frontmatter.aside = false;
      pageData.frontmatter.pageClass = [pageData.frontmatter.pageClass, 'ccv-page'].filter(Boolean).join(' ');
    },
  };
}
