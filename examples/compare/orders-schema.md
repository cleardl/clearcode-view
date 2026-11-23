# 订单管理数据库模型

六张物理表完整展示字段、SQL 类型、PK / FK / UK、引用目标和五条关系。order 是枢纽，order_item 与 payment 分别连接商品明细和支付尝试。

::: diagram id="orders-schema"

```mermaid
---
title: "Order management schema"
---
  %% ccv:diagram {"kind":"erd","locale":"en"}
erDiagram
  direction LR
  %% ccv:node customer {"tag":"accounts"}
  customer["customer"] {
    bigint id PK
    varchar(255) email UK
    varchar(120) display_name
    timestamptz created_at
  }
  %% ccv:node order {"tag":"checkout"}
  order["order"] {
    bigint id PK
    bigint customer_id FK "references customer.id"
    varchar(32) status
    numeric(12,2) total_amount
    char(3) currency
    timestamptz placed_at
    timestamptz updated_at
  }
  %% ccv:node order_item {"tag":"line items"}
  order_item["order_item"] {
    bigint id PK
    bigint order_id FK "references order.id"
    bigint product_id FK "references product.id"
    int quantity
    numeric(12,2) unit_price
    numeric(12,2) discount_amount
  }
  %% ccv:node product {"tag":"catalog"}
  product["product"] {
    bigint id PK
    varchar(64) sku UK
    varchar(160) name
    numeric(12,2) price
    numeric(12,2) cost_amount
    boolean active
    timestamptz created_at
  }
  %% ccv:node inventory {"tag":"catalog"}
  inventory["inventory"] {
    bigint id PK
    bigint product_id FK "references product.id"
    varchar(16) warehouse_code
    int quantity
    int reserved_quantity
    timestamptz updated_at
  }
  %% ccv:node payment {"tag":"checkout"}
  payment["payment"] {
    bigint id PK
    bigint order_id FK "references order.id"
    varchar(32) method
    numeric(12,2) amount
    timestamptz paid_at
    varchar(64) external_ref
  }
  order }|--|| customer : "placed by"
  payment }o..|| order : " "
  order_item }|--|| order : " "
  order_item }|--|| product : " "
  inventory }|--|| product : " "
```

```diagram-view
version: 1
overview: "#overview"
details: {}
```

:::

## 阅读重点 {#overview}

六张物理表完整展示字段、SQL 类型、PK / FK / UK、引用目标和五条关系。order 是枢纽，order_item 与 payment 分别连接商品明细和支付尝试。

customer.email 与 product.sku 是唯一键；子表中的外键字段继续显示其引用目标。

payment 一侧允许零到多条记录，且与 order 是非识别关系；其他关系按原例保留强制性。

checkout、catalog、accounts 与 line items 的域归属写在正文索引中。
### 功能域索引

- **accounts**：customer。
- **checkout**：order、payment。
- **line items**：order_item。
- **catalog**：product、inventory。

## 来源

- [orders.erd.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/orders.erd.json)，固定提交 `7e45f36c66de`。
