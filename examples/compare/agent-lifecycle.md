# Agent 运行状态与恢复

五阶段主线从 Queued 到 Completed。Needs Approval 和 Blocked 是等待状态，Failed 有重试回路；Cancelled 与 Expired 是终止出口。

::: diagram id="agent-lifecycle"

```mermaid
---
title: "Agent Run Lifecycle"
---
  %% ccv:diagram {"kind":"lifecycle"}
stateDiagram-v2
  direction LR
  %% ccv:node n_queued {"step":"01","kind":"start","main":true}
  state "Queued<br/>request accepted<br/>entry" as n_queued
  %% ccv:node n_planning {"step":"02","kind":"active","main":true}
  state "Planning<br/>build task graph<br/>model" as n_planning
  %% ccv:node n_executing {"step":"03","kind":"active","main":true}
  state "Executing<br/>tool calls<br/>work" as n_executing
  %% ccv:node n_reviewing {"step":"04","kind":"decision","main":true}
  state "Reviewing<br/>quality gate<br/>check" as n_reviewing
  %% ccv:node n_completed {"step":"05","kind":"success","main":true}
  state "Completed<br/>final response<br/>done" as n_completed
  %% ccv:node n_approval {"kind":"waiting"}
  state "Needs Approval<br/>human gate<br/>pause" as n_approval
  %% ccv:node n_failed {"kind":"failure"}
  state "Failed<br/>recoverable error<br/>retryable" as n_failed
  %% ccv:node n_blocked {"kind":"waiting"}
  state "Blocked<br/>missing input<br/>wait" as n_blocked
  %% ccv:node n_cancelled {"kind":"failure"}
  state "Cancelled<br/>user stopped<br/>terminal" as n_cancelled
  %% ccv:node n_expired {"kind":"failure"}
  state "Expired<br/>timeout<br/>terminal" as n_expired
  n_queued --> n_planning: start
  n_planning --> n_executing: plan ready
  n_executing --> n_reviewing: steps done
  n_reviewing --> n_completed: pass
  %% ccv:edge transition-4 {"variant":"security"}
  n_executing --> n_approval: risky tool
  n_approval --> n_executing: approved
  %% ccv:edge transition-6 {"variant":"security"}
  n_approval --> n_cancelled: user denies
  %% ccv:edge transition-7 {"variant":"security"}
  n_executing --> n_failed: tool error
  %% ccv:edge transition-8 {"variant":"dashed"}
  n_failed --> n_executing: retry
  n_reviewing --> n_blocked: needs input
  n_blocked --> n_reviewing: input given
  %% ccv:edge transition-11 {"variant":"security"}
  n_blocked --> n_expired: no reply 24h
```

```diagram-view
version: 1
overview: "#overview"
details: {}
```

:::

## 阅读重点 {#overview}

五阶段主线从 Queued 到 Completed。Needs Approval 和 Blocked 是等待状态，Failed 有重试回路；Cancelled 与 Expired 是终止出口。

审批等待之后可 approved 返回 Executing，也可 user denies 进入 Cancelled。

Failed → Executing 与 Blocked → Reviewing 是不同恢复回路；原例的 no reply 24h 才让 Blocked 进入 Expired。

## 来源

- [agent-run.lifecycle.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/agent-run.lifecycle.json)，固定提交 `7e45f36c66de`。
