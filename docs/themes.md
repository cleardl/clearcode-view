# 展示主题

主题由宿主选择。绘制后端确定图元与布局，主题提供配色、字体和控件样式。内置 Studio 浅色及 Blueprint 深色。后端的选择和注册见[渲染后端](renderers.md)。

## 注册与选择

~~~ts
import { clearcodeViewPlugin } from 'clearcode-view/vue';
import { studioTheme, blueprintTheme } from 'clearcode-view/themes';
import 'clearcode-view/style.css';

app.use(clearcodeViewPlugin, {
  themes: [studioTheme, blueprintTheme],
  theme: 'studio',
});
~~~

`themes` 是非空、ID 唯一的列表，`theme` 选择其中一项作为应用主题。宿主可调用 `useDisplayPreferences().followColorScheme` 切换匹配 `colorScheme` 的主题，无匹配项时沿用应用主题。向 `DiagramView` 传入 theme 对象可固定单图主题。VitePress 接入见[使用文档](usage.md#vitepress-接入)。

扩展现有主题时，`variables` 提供组件的 CSS 变量，`mermaid` 配置原生 `theme`、`look` 和 `themeVariables`。

~~~ts
import { studioTheme, type ClearcodeTheme } from 'clearcode-view/themes';

export const teamTheme: ClearcodeTheme = {
  ...studioTheme,
  id: 'team',
  label: 'Team',
  variables: { ...studioTheme.variables, '--ccv-accent': '#2055a0', '--ccv-radius': '8px' },
};
~~~

## 原生 Mermaid 职责标记

职责色随绘制风格呈现，关系含义由标签、线型和正文表达。写法见[图文协议](protocol.md#原生-mermaid-职责标记)。

## 阅读尺寸

全图展示完整结构，适宽按可用画布宽度缩放，阅读尺寸保留可读字号。宽图可收起解读栏后再缩放或拖动。时序图和职责泳道优先以可读的大小展示。
