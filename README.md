# clearcode-view

用 Markdown 和 Mermaid 编写架构、流程和问题分析文档。页面把图和正文并排展示，读者可选择图中的对象、展开分组，或按作者安排的步骤阅读。

示例站可在导航栏切换图表风格，同一份内容可以用不同样式阅读。可从[示例首页](examples/index.md)进入，也可查看[四组同源对照](examples/compare/diagram-design.md)。

## 本地预览

需要 Node.js 22.12 或以上版本。在仓库根目录运行：

~~~sh
npm ci --ignore-scripts
npm run dev
~~~

打开 [http://127.0.0.1:5198/](http://127.0.0.1:5198/) 查看示例。以下命令用于校验和构建：

~~~sh
npm run check   # 类型、测试、库构建与文档检查
npm run build   # 构建组件库与示例站
~~~

组件库产物在 `dist/`，示例站产物在 `examples/.vitepress/dist/`。业务项目可通过本地 npm 包接入 VitePress 或 Vue，见[接入文档](docs/usage.md)。

## 文档

| 要做什么 | 从哪里开始 |
| --- | --- |
| 用 AI 编写或维护文档 | [SKILL.md](SKILL.md) |
| 编写 Mermaid 图、解读和阅读步骤 | [图文协议](docs/protocol.md) |
| 安装、打包或接入宿主项目 | [使用与交付](docs/usage.md) |
| 配置主题、明暗和职责样式 | [展示主题](docs/themes.md) |
| 选择或实现绘制后端 | [渲染后端](docs/renderers.md) |
| 理解模块边界与生命周期 | [源码架构](docs/architecture.md) |
