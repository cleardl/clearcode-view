# 订单事件拓扑、死信与受控重放

订单与支付生产者写入不同版本和分区数的 Topic，处理器汇入幂等物化视图；Fulfillment 与 Analytics 消费不同结果，毒性事件进入 DLQ，由 On-call 检查并经受控批次重放。

::: diagram id="event-stream"

```mermaid
---
title: "Order Event-stream Topology"
---
  %% ccv:diagram {"kind":"dataflow"}
flowchart LR
  subgraph stage_0["Producers"]
    n_checkout["Checkout API<br/>order producer<br/>team commerce"]:::ccv-frontend
    n_billing["Billing API<br/>payment producer<br/>team money"]:::ccv-backend
  end
  subgraph stage_1["Transit"]
    n_orders["orders.v1<br/>12 partitions<br/>key: order_id"]:::ccv-messagebus
    n_payments["payments.v2<br/>8 partitions<br/>key: order_id"]:::ccv-messagebus
  end
  subgraph stage_2["Processors"]
    n_validate["Order Validate<br/>group fulfillment<br/>ordered"]:::ccv-backend
    n_enrich["Payment Enrich<br/>group analytics<br/>at-least-once"]:::ccv-backend
  end
  subgraph stage_3["State + recovery"]
    n_state[("Order State<br/>materialized view<br/>idempotent")]:::ccv-database
    n_dlq["events.dlq<br/>poison events<br/>7-day retention"]:::ccv-messagebus
  end
  subgraph stage_4["Consumers"]
    n_fulfillment["Fulfillment<br/>shipping workflow<br/>consumer"]:::ccv-backend
    n_analytics[("Analytics<br/>streaming facts<br/>consumer")]:::ccv-database
    n_replay["Replay Tool<br/>approved batch<br/>operator gate"]:::ccv-security
    n_ops["On-call<br/>DLQ owner<br/>SRE"]:::ccv-external
  end
  n_checkout rel_0@==>|"OrderPlaced<br/>schema v1"| n_orders
  class rel_0 ccv-backend
  n_billing rel_1@==>|"PaymentCaptured<br/>schema v2"| n_payments
  class rel_1 ccv-backend
  n_orders rel_2@==>|"ordered orders<br/>consumer group"| n_validate
  class rel_2 ccv-backend
  n_payments rel_3@==>|"payment facts<br/>at-least-once"| n_enrich
  class rel_3 ccv-backend
  n_validate rel_4@==>|"valid order<br/>idempotent"| n_state
  class rel_4 ccv-backend
  n_enrich rel_5@-->|"enriched payment<br/>idempotent"| n_state
  n_state rel_6@==>|"ready orders<br/>read model"| n_fulfillment
  class rel_6 ccv-backend
  n_state rel_7@-->|"order facts<br/>non-PII"| n_analytics
  n_validate rel_8@-->|"invalid event<br/>dead letter"| n_dlq
  class rel_8 ccv-security
  n_enrich rel_9@-->|"poison event<br/>dead letter"| n_dlq
  class rel_9 ccv-security
  n_dlq rel_10@-->|"failure sample<br/>restricted"| n_ops
  class rel_10 ccv-security
  n_dlq rel_11@-.->|"approved replay<br/>audited batch"| n_replay
  class rel_11 ccv-messagebus

  %% ccv:edge rel_8 {"variant":"security"}
  %% ccv:edge rel_9 {"variant":"security"}
  %% ccv:edge rel_10 {"variant":"security"}
```

```diagram-view
version: 1
overview: "#overview"
details:
  node:n_checkout: "#stage-0"
  node:n_billing: "#stage-0"
  group:stage_0: "#stage-0"
  node:n_orders: "#stage-1"
  node:n_payments: "#stage-1"
  group:stage_1: "#stage-1"
  node:n_validate: "#stage-2"
  node:n_enrich: "#stage-2"
  group:stage_2: "#stage-2"
  node:n_state: "#stage-3"
  node:n_dlq: "#stage-3"
  group:stage_3: "#stage-3"
  node:n_fulfillment: "#stage-4"
  node:n_analytics: "#stage-4"
  node:n_replay: "#stage-4"
  node:n_ops: "#stage-4"
  group:stage_4: "#stage-4"
  edge:rel_0: "#stage-1"
  edge:rel_1: "#stage-1"
  edge:rel_2: "#stage-2"
  edge:rel_3: "#stage-2"
  edge:rel_4: "#stage-3"
  edge:rel_5: "#stage-3"
  edge:rel_6: "#stage-4"
  edge:rel_7: "#stage-4"
  edge:rel_8: "#stage-3"
  edge:rel_9: "#stage-3"
  edge:rel_10: "#stage-4"
  edge:rel_11: "#stage-4"
```

:::

## 阅读重点 {#overview}

订单与支付生产者写入不同版本和分区数的 Topic，处理器汇入幂等物化视图；Fulfillment 与 Analytics 消费不同结果，毒性事件进入 DLQ，由 On-call 检查并经受控批次重放。

At-least-once 投递不能直接推出业务效果只发生一次，原例用幂等物化视图区分这两件事。

失败样本和重放各有一条出口，不能把 DLQ 视作无主的终点。

## Producers {#stage-0}

Checkout API 与 Billing API 分别生产订单和支付事件，团队归属独立。

## Transit {#stage-1}

orders.v1 与 payments.v2 保留版本、分区数和 order_id 分区键。

## Processors {#stage-2}

Order Validate 与 Payment Enrich 属于不同消费组；有序和 at-least-once 标记分别保留。

## State + recovery {#stage-3}

Order State 是幂等物化视图，events.dlq 保存毒性事件并有 7-day retention。

## Consumers {#stage-4}

Fulfillment 与 Analytics 消费不同资产；On-call 检查失败样本，Replay Tool 执行获批、可审计的批量重放。

## 来源

- [event-stream.dataflow.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/event-stream.dataflow.json)，固定提交 `7e45f36c66de`。
