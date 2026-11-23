# 订阅计费与租户数据模型

十一张表覆盖租户、成员关系、套餐与价格、订阅、发票、支付方式、支付和退款。所有字段、键角色与十一条关系保留在 ER 图中。

::: diagram id="billing-schema"

```mermaid
---
title: "Subscription billing schema"
---
  %% ccv:diagram {"kind":"erd","locale":"en"}
erDiagram
  direction LR
  %% ccv:node tenant {"tag":"accounts"}
  tenant["tenant"] {
    uuid id PK
    varchar(64) slug UK
    varchar(160) name
    varchar(16) status
    timestamptz created_at
  }
  %% ccv:node user_account {"tag":"accounts"}
  user_account["user_account"] {
    uuid id PK
    varchar(255) email UK
    varchar(120) display_name
    char(5) locale
    boolean mfa_enabled
    timestamptz created_at
  }
  %% ccv:node membership {"tag":"accounts"}
  membership["membership"] {
    bigint id PK
    uuid tenant_id FK "references tenant.id"
    uuid user_id FK "references user_account.id"
    varchar(24) role
    timestamptz joined_at
  }
  %% ccv:node plan {"tag":"catalog"}
  plan["plan"] {
    varchar(32) id PK
    varchar(80) name
    varchar(16) billing_interval
    boolean seat_based
    boolean active
  }
  %% ccv:node price {"tag":"catalog"}
  price["price"] {
    bigint id PK
    varchar(32) plan_id FK "references plan.id"
    char(3) currency
    numeric(12,2) unit_amount
    timestamptz effective_from
  }
  %% ccv:node subscription {"tag":"billing"}
  subscription["subscription"] {
    bigint id PK
    uuid tenant_id FK "references tenant.id"
    bigint price_id FK "references price.id"
    varchar(16) status
    int seats
    timestamptz started_at
    timestamptz canceled_at
  }
  %% ccv:node invoice {"tag":"billing"}
  invoice["invoice"] {
    bigint id PK
    bigint subscription_id FK "references subscription.id"
    varchar(32) number UK
    varchar(16) status
    numeric(12,2) subtotal_amount
    numeric(12,2) tax_amount
    numeric(12,2) total_amount
    timestamptz issued_at
  }
  %% ccv:node invoice_line {"tag":"billing"}
  invoice_line["invoice_line"] {
    bigint id PK
    bigint invoice_id FK "references invoice.id"
    varchar(200) description
    int quantity
    numeric(12,2) unit_amount
    numeric(12,2) amount
  }
  %% ccv:node payment_method {"tag":"payments"}
  payment_method["payment_method"] {
    bigint id PK
    uuid tenant_id FK "references tenant.id"
    varchar(16) kind
    char(4) last4
    date expires_at
    boolean is_default
  }
  %% ccv:node payment {"tag":"payments"}
  payment["payment"] {
    bigint id PK
    bigint invoice_id FK "references invoice.id"
    bigint payment_method_id FK "references payment_method.id"
    numeric(12,2) amount
    varchar(16) status
    timestamptz captured_at
  }
  %% ccv:node refund {"tag":"payments"}
  refund["refund"] {
    bigint id PK
    bigint payment_id FK "references payment.id"
    numeric(12,2) amount
    varchar(120) reason
    timestamptz created_at
  }
  membership }|--|| tenant : " "
  membership }|--|| user_account : " "
  price }|--|| plan : " "
  subscription }|--|| tenant : " "
  subscription }|--|| price : " "
  invoice }|--|| subscription : " "
  invoice_line }|--|| invoice : " "
  payment_method }|--|| tenant : " "
  payment }o--|| invoice : " "
  payment }|--|| payment_method : " "
  refund }|--|| payment : " "
```

```diagram-view
version: 1
overview: "#overview"
details: {}
```

:::

## 阅读重点 {#overview}

十一张表覆盖租户、成员关系、套餐与价格、订阅、发票、支付方式、支付和退款。所有字段、键角色与十一条关系保留在 ER 图中。

user_account 通过 membership 进入 tenant；成员关系同时携带两个外键。

subscription 绑定 price，invoice 聚合 invoice_line；金额使用 numeric(12,2)，而不是浮点数。

invoice 可以尚未产生 payment；refund 则必须指向已有 payment。这两个可选性判断不能混用。
### 功能域索引

- **accounts**：tenant、user_account、membership。
- **catalog**：plan、price。
- **billing**：subscription、invoice、invoice_line。
- **payments**：payment_method、payment、refund。

## 来源

- [subscription-billing.erd.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/subscription-billing.erd.json)，固定提交 `7e45f36c66de`。
