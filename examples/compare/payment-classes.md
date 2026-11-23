# 支付模块接口与渠道实现

OrderService 依赖 PaymentGateway 接口创建订单并启动支付；CardGateway 与 WalletGateway 分别实现渠道能力。五个类型保留属性、方法、可见性和四条关系。

::: diagram id="payment-classes"

```mermaid
---
title: "Payment module types"
---
  %% ccv:diagram {"kind":"class"}
classDiagram
  direction TB
  %% ccv:node order_service {"sublabel":"Creates orders and starts payment","kind":"class"}
  class order_service["OrderService"] {
    -PaymentGateway gateway
    +createOrder(cart: Cart) Order
    +checkout(order: Order) Receipt
  }
  %% ccv:node payment_gateway {"sublabel":"Payment contract every channel fulfils","kind":"interface"}
  class payment_gateway["PaymentGateway"] {
    <<interface>>
    +pay(amount: Money)* Result
  }
  %% ccv:node order {"sublabel":"Order identity, amount, and status","kind":"class"}
  class order["Order"] {
    +OrderId id
    +Money amount
    +OrderStatus status
    +markPaid() void
  }
  %% ccv:node card_gateway {"sublabel":"Charges a bank card","kind":"class"}
  class card_gateway["CardGateway"] {
    +pay(amount: Money) Result
  }
  %% ccv:node wallet_gateway {"sublabel":"Debits a stored wallet balance","kind":"class"}
  class wallet_gateway["WalletGateway"] {
    +pay(amount: Money) Result
  }
  order_service ..> payment_gateway : pays through
  order_service ..> order : creates
  card_gateway ..|> payment_gateway
  wallet_gateway ..|> payment_gateway
```

```diagram-view
version: 1
overview: "#overview"
details: {}
```

:::

## 阅读重点 {#overview}

OrderService 依赖 PaymentGateway 接口创建订单并启动支付；CardGateway 与 WalletGateway 分别实现渠道能力。五个类型保留属性、方法、可见性和四条关系。

OrderService → PaymentGateway 是使用依赖；CardGateway / WalletGateway → PaymentGateway 是接口实现，箭头线型和端点不同。

Order 表达订单身份、金额和状态，不把实体与渠道服务合并为同一个类型。

## 来源

- [payments.class.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/payments.class.json)，固定提交 `7e45f36c66de`。
