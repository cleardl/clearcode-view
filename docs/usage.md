# 使用与交付

源码仓库通过 [SKILL.md](../SKILL.md) 向 Agent 提供操作说明。安装 npm 包后，可直接读取包内同版本的 skill、文档和源码。示例站的运行方式见 [README](../README.md)。

## 本地打包

在源码仓库运行 `npm run build:lib` 和 `npm pack --ignore-scripts`。把生成的压缩包放入业务项目的 `vendor/`，使用相对路径依赖实际文件名，并提交锁文件。当前包使用 `private: true`，以本地压缩包交付。

包内 `dist/` 提供运行代码、样式与类型声明。`src/`、`docs/` 和 `examples/` 供阅读和参考。上游同步、研究图生成和测试使用源码仓库。

## 包入口

| 入口 | 用途 |
| --- | --- |
| `clearcode-view` | Markdown 文档编译与正文引用校验 |
| `clearcode-view/core` | 内容模型、直接输入工厂与校验 |
| `clearcode-view/mermaid` | Mermaid 原文到图语义索引 |
| `clearcode-view/renderers` | 绘制后端契约、语义绑定与内置后端 |
| `clearcode-view/vue` | Vue 组件、插件与展示偏好 |
| `clearcode-view/vitepress` | Node 端站点配置、Markdown 和导航 |
| `clearcode-view/vitepress/theme` | VitePress 客户端目录调宽组件 |
| `clearcode-view/themes` | 主题接口和预设 |
| `clearcode-view/style.css` | 图形、主题与 VitePress 布局样式 |

## VitePress 接入

在业务项目中安装本地包和框架。压缩包名以本次打包结果为准。

~~~sh
npm install --save-dev ./vendor/clearcode-view-0.5.4.tgz vitepress@1.6.4 vue@3.5.45 --ignore-scripts
~~~

假设内容位于 `docs/`，在 `docs/.vitepress/config.ts` 引用配置。

~~~ts
import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';
import { clearcodeViewConfig } from 'clearcode-view/vitepress';

export default defineConfig(clearcodeViewConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
}));
~~~

在 `docs/.vitepress/theme/index.ts` 注册组件和样式。

~~~ts
import DefaultTheme from 'vitepress/theme';
import { defineComponent, h, onMounted, watch } from 'vue';
import { useData } from 'vitepress';
import { clearcodeViewPlugin, DiagramStyleSelect, useDisplayPreferences } from 'clearcode-view/vue';
import { VitePressSidebarResize } from 'clearcode-view/vitepress/theme';
import { customRenderer, archifyRenderer, diagramDesignRenderer } from 'clearcode-view/renderers';
import 'clearcode-view/style.css';

export default {
  extends: DefaultTheme,
  Layout: defineComponent({
    setup() {
      const { isDark } = useData(), display = useDisplayPreferences();
      onMounted(() => display.followColorScheme(isDark.value ? 'dark' : 'light'));
      watch(isDark, dark => display.followColorScheme(dark ? 'dark' : 'light'));
      return () => h(DefaultTheme.Layout, { class: 'ccv-vitepress' }, {
        'nav-bar-content-after': () => h(DiagramStyleSelect),
        'layout-bottom': () => h(VitePressSidebarResize),
      });
    },
  }),
  enhanceApp({ app }) {
    app.use(clearcodeViewPlugin, { renderers: [archifyRenderer, customRenderer, diagramDesignRenderer] });
  },
};
~~~

在 `docs/clearcode.config.yaml` 配置[导航](protocol.md#导航配置)。导航路径相对文档根目录，正文链接相对各自的 Markdown。用 `vitepress dev docs` 预览，用 `vitepress build docs` 生成静态站点。合并 Vite 配置时，保留预设的 `plugins` 和 `ssr.noExternal`，用于监听导航变更和处理主题组件的 CSS。

`ccv-vitepress` 启用紧凑布局，目录宽度与正文联动，窄屏使用 VitePress 的目录抽屉。`VitePressSidebarResize` 支持拖动和键盘调宽，双击恢复 240px，范围为 180–480px。可通过 `storageKey` 指定宽度的存储键。导航栏的 `DiagramStyleSelect` 统一切换图表风格，配色跟随站点明暗。

## 直接使用解析与 Vue 组件

~~~ts
import { compileDocument } from 'clearcode-view';
import { DiagramView } from 'clearcode-view/vue';
import 'clearcode-view/style.css';

const document = compileDocument(markdownText, { file: 'analysis.md' });
// 将 document.diagrams 中的一个模型作为 DiagramView 的 model 属性。
~~~

`compileDocument` 可以在 Node 中使用。跨文档的文件与锚点由 `loadNavigation` 校验，图的语法与元素绑定在组件挂载后校验。

## 不经过 Markdown 的接入

~~~vue
<script setup lang="ts">
import { createDiagram } from 'clearcode-view/core';
import { DiagramView } from 'clearcode-view/vue';
import 'clearcode-view/style.css';

const model = createDiagram({
  id: 'request',
  source: 'flowchart LR\nclient[Client] send@--> gateway[Gateway]',
  details: { 'node:gateway': '#gateway' },
  sections: {
    '#gateway': { ref: '#gateway', title: '请求网关', html: '<p>接纳请求并分配执行实例。</p>' },
  },
});
</script>

<template><DiagramView :model="model" /></template>
~~~

`sections` 的 HTML 来自可信宿主。外部富文本先由宿主清洗，再传给组件。可参考[独立 Vue 组件示例](../examples/standalone.md)和[后端配置](renderers.md)。

## 迁移已有文档

将旧图的节点、连线和消息转写为 Mermaid，保留 Markdown 解读和可引用的锚点。用实际安装的包检查图关系、解读、折叠、滚轮、阅读链接及多图切换。业务项目继续维护自己的源码映射。静态站点是当前的页面交付方式。
