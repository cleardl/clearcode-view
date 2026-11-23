# 架构设计

Markdown 编译与宿主直接输入共享同一个 `DiagramModel`。模型保留 Mermaid 原文、正文片段和阅读引用。浏览器解析图的语义，选择绘制后端，再由公共组件管理解读与操作。

~~~text
Markdown + 交互声明 ── compileDocument ──┐
                                         ├── DiagramModel
Mermaid + 宿主解读 ── createDiagram ──────┘        │
                                         Mermaid 原文 → 语义索引
                                                 │
                                         绘制后端 → SVG 与语义绑定
                                                 │
                                         公共组件 → 选择、解读、步骤与画布
~~~

## 模块职责

| 源码目录 | 职责 |
| --- | --- |
| `src/core/` | 内容模型及直接输入工厂，独立于 Markdown、Vue 和绘图引擎 |
| `src/protocol/` | 将 Markdown、YAML 和正文锚点编译为图文模型，保留文件与行号诊断 |
| `src/mermaid/` | 解析 Mermaid 语义，为原生绘制后端适配布局与 SVG 元素 |
| `src/renderers/` | 提供后端接口、能力检查、三种内置绘制实现及其语义绑定 |
| `src/interaction/` | 根据语义标识连接可选择元素、键盘焦点与折叠控件 |
| `src/components/` | 公共画布、解读栏、步骤和风格选择组件 |
| `src/themes/` | 主题预设、面板样式、后端表现与应用级展示偏好 |
| `src/integrations/vitepress/` | 文档编译、导航、页面路由与目录布局 |

公共子路径按这些职责导出，见[包入口](usage.md)。渲染后端只接收 Mermaid 原文与语义、主题及绘制状态。文档编译和跨页导航由独立的入口处理。

## Mermaid 解析与绘制

`mermaid/engine.ts` 串行管理 Mermaid 的解析、配置和渲染。流程图、block 和时序图的适配器分别读取原生解析结果，建立节点、关系、分组或消息的索引。时序消息注释借助临时 Note 标记对应原始消息，实际绘制仍使用原文，因此同名消息可以分别关联。升级 Mermaid 时需重新核对解析数据与生成的 SVG 元素。

定制版和简洁版共用 `renderers/native.ts`，各自提供展示样式。流程图使用 `mermaid/layout.ts` 注册的 ELK 布局，方向取自原文。`mermaid/straighten.ts` 在空间允许时整理线段，保留与关系标签及其他图元的间隔。带 `ccv-swimlane` 的 block 由 `mermaid/swimlanes.ts` 和 `mermaid/swimlane-route.ts` 从原生网格推导卡片位置和正交路线。

丰富版将 Mermaid 语义投影到 Archify 的内部输入，调用对应图类型的绘制器，再将 SVG 语义属性绑定到公共组件。投影、布局、支持范围和上游来源见 [Archify 适配](archify-renderer.md)。

## 状态与组件生命周期

`DiagramView.vue` 分别管理当前选择、步骤、折叠分组和画布位置。它以图实例隔离状态，用图 ID 保存阅读链接，重新绘制时校验已有选择。后端和配色偏好由应用共享，配置方式见[渲染后端](renderers.md)和[主题](themes.md)。

重绘替换旧 SVG 前释放绘图绑定与画布控制器，组件卸载时解除观察器和页面监听。异步绘制会丢弃过期结果。后端临时测量与挂载资源的约定见[后端接口](renderers.md#后端接口)，阅读操作见[图文协议](protocol.md#公共交互行为)。

## VitePress 集成

Node 入口读取导航，编译 Markdown，并将图文容器转换为 Vue 组件。只供解读栏显示的 `diagram-details` 在页面正文保留定位锚点，章节内容随图文模型传入组件。点击锚点时，组件据此恢复解读对象。

客户端主题入口负责可拖动的目录和站点布局。`ccv-vitepress` 将布局样式限定在采用该主题的站点。Markdown 校验可在 Node 中执行，Mermaid 解析和绘制使用提供 DOM 的运行环境。集成与构建命令见[使用文档](usage.md#vitepress-接入)。

修改协议时验证声明与引用，修改图适配时验证语义与图元绑定，修改阅读交互时验证多图、路由切换和卸载。测试位于 `tests/`，页面验证使用示例站。
