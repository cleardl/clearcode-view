# Archify 示例对照

[查看三种风格的同源对照](diagram-design.md)：定制版、Archify 丰富版和 Diagram Design 简洁版读取同一份 Markdown/Mermaid。用站点导航栏的“图表风格”切换，以下各行提供 Archify 参考页。

共 **24 个对照页面、10 类原生图示、25 份源示例**。每个页面都提供 clearcode-view 的 Markdown 版本、对应原版与中文解读。架构变更前后在同一页展开；原版固定于同一上游提交。

## 系统架构

| 示例 | 对照重点 | clearcode-view | Archify 原版 |
| --- | --- | --- | --- |
| Web 应用架构 | 区域、安全组、同步与异步依赖 | [打开对照](web-app.md) | [打开原版](/reference/archify/web-app.html){target="_self"} |
| 生产部署与跨区域灾备 | 区域、私有网络、跨 AZ、灾备复制与运维归属 | [打开对照](production-deployment.md) | [打开原版](/reference/archify/production-deployment.html){target="_self"} |
| AI 交付链与运行依赖 | 交付主线、运行依赖和 webhook 返回 | [打开对照](brand-delivery.md) | [打开原版](/reference/archify/brand-delivery.html){target="_self"} |
| Checkout 架构变更前后 | 同范围前后版本、授权责任迁移 | [打开对照](checkout-changes.md) | [Baseline](/reference/archify/checkout-changes-before.html){target="_self"} / [Fraud Gate](/reference/archify/checkout-changes-after.html){target="_self"} |

## 流程与时序

| 示例 | 对照重点 | clearcode-view | Archify 原版 |
| --- | --- | --- | --- |
| Agent 分层架构与流转 | 四层职责、审批分支、返回与证据 | [打开对照](tool-workflow.md) | [打开原版](/reference/archify/tool-workflow.html){target="_self"} |
| 缓存未命中时序 | 调用、回复、激活与异步通知 | [打开对照](cache-miss.md) | [打开原版](/reference/archify/cache-miss.html){target="_self"} |
| 发布交付、质量门禁与回滚 | 六方职责、停止条件与恢复回边 | [打开对照](release-delivery.md) | [打开原版](/reference/archify/release-delivery.html){target="_self"} |
| 故障响应与恢复证据 | 故障指挥、缓解与恢复区分、升级旁路 | [打开对照](incident-response.md) | [打开原版](/reference/archify/incident-response.html){target="_self"} |
| 假期与补班排期示例 | 固定日期示例、非软件流程、主线与调休分支 | [打开对照](holiday-planning.md) | [打开原版](/reference/archify/holiday-planning.html){target="_self"} |
| 异步任务接纳、执行与结果对齐 | 14 条消息、重试、先落库后通知、双观察路径 | [打开对照](async-jobs.md) | [打开原版](/reference/archify/async-jobs.html){target="_self"} |

## 数据流与模型

| 示例 | 对照重点 | clearcode-view | Archify 原版 |
| --- | --- | --- | --- |
| 产品分析数据流与 PII 分离 | 五阶段数据资产、敏感信息路径与派生消费者 | [打开对照](product-analytics.md) | [打开原版](/reference/archify/product-analytics.html){target="_self"} |
| 订单事件拓扑、死信与受控重放 | 12 个节点、分区键、消费组、DLQ 归属和审计重放 | [打开对照](event-stream.md) | [打开原版](/reference/archify/event-stream.html){target="_self"} |
| 订单管理数据库模型 | 完整字段、键角色、可选支付和识别关系 | [打开对照](orders-schema.md) | [打开原版](/reference/archify/orders-schema.html){target="_self"} |
| 订阅计费与租户数据模型 | 11 张表、全量字段、租户隔离、账单与资金链 | [打开对照](billing-schema.md) | [打开原版](/reference/archify/billing-schema.html){target="_self"} |
| 支付模块接口与渠道实现 | 依赖倒置、接口实现、成员签名 | [打开对照](payment-classes.md) | [打开原版](/reference/archify/payment-classes.html){target="_self"} |
| 支付处理器、共享恢复与继承层次 | 接口、抽象类、组合、聚合、静态与抽象成员 | [打开对照](processor-hierarchy.md) | [打开原版](/reference/archify/processor-hierarchy.html){target="_self"} |

## 状态与层次

| 示例 | 对照重点 | clearcode-view | Archify 原版 |
| --- | --- | --- | --- |
| Agent 运行状态与恢复 | 10 个状态、12 条转移、等待与终止区分 | [打开对照](agent-lifecycle.md) | [打开原版](/reference/archify/agent-lifecycle.html){target="_self"} |
| 部署生命周期、健康暂停与回滚 | 12 个状态、15 条转移、健康恢复与回滚失败 | [打开对照](deployment-lifecycle.md) | [打开原版](/reference/archify/deployment-lifecycle.html){target="_self"} |
| 支付平台能力分解树 | 10 个节点、单父包含关系与调用关系区分 | [打开对照](payment-capabilities.md) | [打开原版](/reference/archify/payment-capabilities.html){target="_self"} |
| Archify 仓库结构分解 | 31 个节点、目录职责与源码导航 | [打开对照](repository-tree.md) | [打开原版](/reference/archify/repository-tree.html){target="_self"} |

## 时间与性能

| 示例 | 对照重点 | clearcode-view | Archify 原版 |
| --- | --- | --- | --- |
| 支付故障事件时间线 | 固定时间轴、三类事件、恢复与关闭区分 | [打开对照](payment-incident.md) | [打开原版](/reference/archify/payment-incident.html){target="_self"} |
| Archify 发布与合并活动时间线 | 20 个事件、多来源、时区对齐与密集记录 | [打开对照](repository-history.md) | [打开原版](/reference/archify/repository-history.html){target="_self"} |
| 结账请求的并行执行瀑布 | 6 个 span、并行区间、父子包络与总时长 | [打开对照](checkout-waterfall.md) | [打开原版](/reference/archify/checkout-waterfall.html){target="_self"} |
| 三 Worker 示例重建瀑布 | 25 个 span、三方并发、嵌套 span 与实测小数 | [打开对照](rebuild-waterfall.md) | [打开原版](/reference/archify/rebuild-waterfall.html){target="_self"} |

## 阅读方式

架构、流程、时序与树图可选择组件或关系对照中文解读；ER、类图、状态机和时间图使用 Mermaid 原生展示，侧栏提供整体阅读重点。复杂图可使用全图、阅读尺寸与收起解读调整阅读范围。示例不强制添加上一步、下一步或字段追踪。

时间线保留事件时间与来源，性能瀑布保留开始、结束、父子和服务归属；ER 保留全部字段、键角色和引用。源示例与保留数量见[来源记录](/reference/archify/source.json)。

参考仓库：[tt-a1i/archify](https://github.com/tt-a1i/archify)，固定提交 `7e45f36c66de1254d5ad6ba1d878f6499ea269fd`。原版文件与按同版本源码生成的参考文件在来源记录中分别注明；许可证及上游声明一并保留。[上游声明](/reference/archify/NOTICE.txt)
