# Mermaid 与渲染后端

绘制后端接收 Mermaid 原文和语义索引。公共 Vue 组件根据后端返回的 SVG 元素绑定组织选择与解读。宿主可使用 [Markdown 编译或直接输入 Mermaid](usage.md) 构造同一个图文模型。

## Mermaid 输入

`clearcode-view/mermaid` 的 `parseMermaid` 接收 `MermaidSource`，返回 `ParsedDiagram`，包含完整原文、原生类型及 `DiagramGraph`。索引记录稳定引用、标签、组和端点，供图文交互使用。flowchart、block 和 sequence 建立元素索引。其他类型按各后端的能力使用原文绘制。解析与绘制需要可用的 DOM。

| 后端 | 呈现方式 |
| --- | --- |
| `customRenderer` | 定制版，使用 Mermaid 原生图元及 ELK 布局，应用职责样式 |
| `archifyRenderer` | 丰富版，调用相应类型的 Archify 绘制器，支持范围见 [Archify 适配](archify-renderer.md) |
| `diagramDesignRenderer` | 简洁版，与定制版共用原生绘制流程，采用中性色、细线和单一强调色 |

## 宿主选择后端

~~~ts
import { clearcodeViewPlugin } from 'clearcode-view/vue';
import { archifyRenderer, customRenderer, diagramDesignRenderer } from 'clearcode-view/renderers';
import 'clearcode-view/style.css';

app.use(clearcodeViewPlugin, {
  renderers: [archifyRenderer, customRenderer, diagramDesignRenderer],
  renderer: archifyRenderer,
});
~~~

`renderers` 注册非空、ID 唯一的列表，`renderer` 指定其中的初始项，省略时使用第一项。只需一种风格时可单独传入 `renderer`。默认使用 Archify。向 `DiagramView` 传入 `renderer` 属性可固定该组件的后端。

宿主在导航栏放置一个 `DiagramStyleSelect`，统一切换已注册的风格。已保存的风格优先于初始配置，并在刷新和同源标签页间共享。存储键默认为 `clearcode-view:renderer`，可通过 `preferenceKey` 自定义或传 `false` 关闭持久化。

## Archify 预设

~~~ts
import { createArchifyRenderer } from 'clearcode-view/renderers';

const rich = createArchifyRenderer({
  preset: 'classic',
  diagrams: { release: { preset: 'signal-flow' } },
});
~~~

`preset` 支持 `classic`、`signal-flow`、`blueprint` 和 `editorial`。`diagrams` 按 `MermaidSource.location.diagram` 匹配。Markdown 容器与 `createDiagram` 默认使用图 ID，宿主自定义 `location` 时需提供相应标识。

## Diagram Design 参考

简洁版借鉴 [Diagram Design 的设计规范](https://github.com/cathrynlavery/diagram-design/tree/f6db0decea96de66b901331a0f79a8d4b147ebae)，采用 Mermaid 自动布局。示例站维护[四组同源对照](../examples/compare/diagram-design.md)，其中固定排版的 HTML 用于比较卡片、留白和路线。保留的输入及输出摘要见[来源记录](../examples/public/reference/diagram-design/source.json)，许可证随参考页保存。

需要重新生成参考页时，在源码仓库构建库，再运行 `node scripts/build-design-comparisons.mjs <Diagram Design checkout>`。输入由现有 Markdown 提供。拓扑变化后复核脚本中的位置和路线。

## 后端接口

`DiagramRenderer`、`RenderedScene`、`MountedDiagram` 和 `RendererContext` 从 `clearcode-view/renderers` 导出。

~~~ts
interface DiagramRenderer {
  id: string;
  label: string;
  resolveTheme?(theme: ClearcodeTheme): ClearcodeTheme;
  supports(diagram: ParsedDiagram): boolean;
  render(diagram: ParsedDiagram, context: RendererContext): Promise<RenderedScene>;
}
~~~

- `renderScene` 先检查 `supports`，不支持时报告文档位置。后端绘制须保留对应类型的完整输入语义。可选的 `resolveTheme` 是纯函数，保留宿主主题的 ID 和名称。
- `render` 返回 SVG 文本和 `mount(svg)`。绘制结束前释放临时测量资源。持久监听在 `mount` 创建，挂载失败时回滚，正常替换和卸载时由 `dispose` 释放。
- `mount` 返回语义绑定、图例和可选的 `readingScale`。公共组件在挂载后读取最终 `viewBox`，并验证可见语义元素都有绑定。已收缩的元素通过可见祖先保持可达。
- 语义绑定允许一个 `ElementRef` 对应多个 SVG 元素，比如时序参与者的上下两处标签。通过 `data-ccv-ref` 和 `bindSemanticElements` 接入键盘与加减号控件。标签可加 `data-ccv-passive="true"`，随选择高亮并跳过 Tab。
- 绘制后端负责布局、图元、图例与视觉反馈，公共组件通过 `ccv-highlight`、`ccv-muted-element` 和 `aria-pressed` 标记阅读状态。后端样式按 `data-renderer` 隔离。
