# Archify 绘制器适配

`archifyRenderer` 将 Mermaid 的原生解析结果投影为 Archify 内部输入，调用[固定版本的绘制器](https://github.com/tt-a1i/archify/tree/7e45f36c66de1254d5ad6ba1d878f6499ea269fd)。架构与类图使用 ELK 派生位置，工作流读取 block 的列、跨度和复合块。参考 HTML 供视觉核对，交互页面从 Markdown 重新绘制。

## 支持范围

| 绘制类型 | Mermaid 输入 | 保留内容 |
| --- | --- | --- |
| architecture | flowchart 或普通 block | 职责卡片、区域与安全组、关系样式、品牌与图例 |
| workflow | 标记 `ccv-swimlane` 的 block | 泳道、阶段、工作组、主路径、异常和恢复路线 |
| sequence | sequenceDiagram | 参与者、消息、自调用、激活和阶段 |
| dataflow | flowchart + `kind: dataflow` | 阶段、资产、消费者、数据分类、死信与重放 |
| lifecycle | stateDiagram-v2 | 状态角色、主路径、失败、循环、返回与条件 |
| erd | erDiagram | 领域、字段与类型、键、关系、基数与识别关系 |
| class | classDiagram | 类、接口、成员、可见性与 UML 关系 |
| tree | flowchart + `kind: tree` | 父子层级、职责与包含关系 |
| timeline | Gantt milestone + `kind: timeline` | 时间戳、时区、泳道、事件类别与详情 |
| waterfall | Gantt + `kind: waterfall` | 服务、父子 span、起止时间与亚毫秒精度 |

类型和主路径等补充信息使用[图语义注释](protocol.md#附加图语义)。表中是已适配的范围。复杂组合状态等未覆盖的语法会报告具体错误。ER、类图、状态和时间类图提供总览解读和画布操作。

## 图形绑定

`src/renderers/archify/bind.ts` 将绘制器返回的语义属性映射到阅读引用和收缩控件。SVG 内部 ID 按实例隔离。时序图顶部和底部的参与者共用同一个引用。自调用沿原生命线绘制回环，阶段和激活区间随消息位置布局。视觉预设由宿主配置，见[后端文档](renderers.md#archify-预设)。

## 来源与同步

浏览器适配副本位于 `src/renderers/archify/upstream/`。固定提交及原始文件摘要见 [sources.json](../src/renderers/archify/upstream/sources.json)，代码、色板、品牌和嵌入字体的归属见 [NOTICE.md](../src/renderers/archify/NOTICE.md) 及同目录许可证。

[对照示例](../examples/compare/index.md)覆盖 24 个页面、25 份原始图。上游提交的 HTML 和基于同一版本生成的 HTML 在[来源清单](../examples/public/reference/archify/source.json)中区分。参考材料的许可和声明随文件保存。

在源码仓库使用 `node scripts/sync-archify.mjs <Archify checkout>` 更新浏览器适配副本。脚本校验上游提交，保留布局、校验和绘制逻辑，并应用 `scripts/patch-sequence.mjs` 的自调用适配。需要从上游 JSON 重新导入示例时使用 `scripts/align-archify-examples.mjs`，执行前先检查会被替换的 Markdown 图体。

## 对齐校验

`tests/fixtures/archify/` 保存固定原始输入。测试验证其摘要、由 Markdown 重新生成的节点、关系、分组、字段和时间数据，并执行各图类型的绘制。页面验证再检查实际排版、标签、明暗以及受影响的选择和收缩。
