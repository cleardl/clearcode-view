# 独立 Mermaid 与渲染后端

下图由 Vue 宿主直接传入 Mermaid 源码、中文说明和关联，没有经过 Markdown 图块解析。画布、选择、解读与折叠仍使用同一套交互组件，默认后端保持现有定制版。

<StandaloneDiagram />

## 接入方式

内容模型使用 `clearcode-view/core` 的 `createDiagram`，Vue 宿主把模型传给 `DiagramView`。文档站中的 Markdown 只承载这个演示页面；图形组件的数据由独立宿主提供。

业务可以在插件选项或组件的 `renderer` 属性中传入固定后端，也可注册 `renderers` 并在宿主布局放置一个 `DiagramStyleSelect`。本站通过导航栏统一切换风格，明暗跟随站点开关。后端接收 Mermaid 原文与语义索引，不读取 Markdown 章节、导航文件或侧栏 HTML。当前可用后端为 `customRenderer`、`archifyRenderer` 与 `diagramDesignRenderer`。

已有 [Agent 分层图](compare/tool-workflow.md)、[Web 架构](compare/web-app.md) 与[缓存时序](compare/cache-miss.md)继续通过 Markdown 入口使用同一条渲染和交互路径。
