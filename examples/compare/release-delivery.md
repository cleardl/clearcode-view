# 发布交付、质量门禁与回滚

提交与 Pull Request 经构建、质量门禁和人工审批后进入灰度发布；生产验证健康才通知发布完成。门禁失败停止晋级，生产验证失败则进入 Rollback，再恢复到 Deploy。

::: diagram id="release-delivery"

```mermaid
---
title: "Release Delivery Workflow"
---
  %% ccv:diagram {"kind":"workflow"}
block
  columns 1
  block:phases["Phases"]
    columns 6
    phase_change["Change"]:2
  %% ccv:node phase_verify {"variant":"emphasis"}
    phase_verify["Build + verify"]:2
  %% ccv:node phase_promote {"variant":"dashed"}
    phase_promote["Promote + observe"]:2
  end
  %% ccv:group lane_0 {}
  block:lane_0["Developer"]
    columns 6
  %% ccv:node n_commit {"main":true}
    n_commit["Commit<br/>signed change"]
  %% ccv:node n_pull_request {"main":true}
    n_pull_request["Pull Request<br/>reviewed diff"]
    space:4
  end
  %% ccv:group lane_1 {}
  block:lane_1["Continuous Integration"]
    columns 6
    space:2
  %% ccv:group workgroup_1_0 {"variant":"emphasis"}
    block:workgroup_1_0["Blocking checks"]:2
      columns 2
  %% ccv:node n_build {"main":true}
      n_build["Build<br/>locked inputs<br/>reproducible"]
  %% ccv:node n_checks {"main":true}
      n_checks["Quality Gates<br/>test + scan<br/>blocking"]
    end
    space:2
  end
  %% ccv:group lane_2 {}
  block:lane_2["Release Governance"]
    columns 6
    space:4
  %% ccv:node n_approval {"main":true}
    n_approval["Approve<br/>release owner<br/>human gate"]
    space:1
  end
  %% ccv:group lane_3 {}
  block:lane_3["Production Environment"]
    columns 6
    space:4
  %% ccv:node n_deploy {"main":true}
    n_deploy["Deploy<br/>canary 10%<br/>production"]
  %% ccv:node n_verify_prod {"main":true}
    n_verify_prod["Verify<br/>smoke + SLO"]
  end
  %% ccv:group lane_4 {}
  block:lane_4["Release Communication"]
    columns 6
    space:5
  %% ccv:node n_announce {"main":true}
    n_announce["Announce<br/>status + notes"]
  end
  %% ccv:group lane_5 {"variant":"exception"}
  block:lane_5["Failure + Rollback"]
    columns 6
    space:2
    n_failed["Stop Release<br/>gate failed"]
  %% ccv:group workgroup_5_0 {"variant":"security"}
    block:workgroup_5_0["Recovery path"]:3
      columns 3
      space:1
      n_rollback["Rollback<br/>last good image<br/>owner: on-call"]
      space:1
    end
  end
  n_commit --> n_pull_request
  n_pull_request -- "merge" ==> n_build
  n_build --> n_checks
  n_checks ==> n_approval
  %% ccv:edge 1-n_approval-n_deploy {"variant":"security"}
  n_approval -.-> n_deploy
  n_deploy --> n_verify_prod
  n_verify_prod -- "healthy" ==> n_announce
  %% ccv:edge 1-n_checks-n_failed {"variant":"security","role":"error"}
  n_checks -- "red" -.-> n_failed
  %% ccv:edge 1-n_verify_prod-n_rollback {"variant":"security","role":"error"}
  n_verify_prod -.-> n_rollback
  %% ccv:edge 1-n_rollback-n_deploy {"role":"return"}
  n_rollback -- "restore" -.-> n_deploy
  class n_commit ccv-frontend
  class n_pull_request ccv-frontend
  class n_build ccv-backend
  class n_checks ccv-security
  class n_approval ccv-security
  class n_deploy ccv-cloud
  class n_verify_prod ccv-backend
  class n_announce ccv-external
  class n_failed ccv-security
  class n_rollback ccv-messagebus
  class phase_change,phase_verify,phase_promote ccv-phase
  class lane_0,lane_1,workgroup_1_0,lane_2,lane_3,lane_4,lane_5,workgroup_5_0,phases ccv-layer
  class lane_0,lane_1,lane_2,lane_3,lane_4,lane_5 ccv-swimlane
```

```diagram-view
version: 1
overview: "#overview"
details:
  group:phases: "#phases"
  node:phase_change: "#phases"
  node:phase_verify: "#phases"
  node:phase_promote: "#phases"
  group:lane_0: "#lane-dev"
  node:n_commit: "#lane-dev"
  node:n_pull_request: "#lane-dev"
  group:workgroup_1_0: "#lane-ci"
  group:lane_1: "#lane-ci"
  node:n_build: "#lane-ci"
  node:n_checks: "#lane-ci"
  group:lane_2: "#lane-approval"
  node:n_approval: "#lane-approval"
  group:lane_3: "#lane-environment"
  node:n_deploy: "#lane-environment"
  node:n_verify_prod: "#lane-environment"
  group:lane_4: "#lane-communication"
  node:n_announce: "#lane-communication"
  group:workgroup_5_0: "#lane-exceptions"
  group:lane_5: "#lane-exceptions"
  node:n_failed: "#lane-exceptions"
  node:n_rollback: "#lane-exceptions"
  edge:1-n_commit-n_pull_request: "#lane-dev"
  edge:1-n_pull_request-n_build: "#lane-ci"
  edge:1-n_build-n_checks: "#lane-ci"
  edge:1-n_checks-n_approval: "#lane-approval"
  edge:1-n_approval-n_deploy: "#lane-environment"
  edge:1-n_deploy-n_verify_prod: "#lane-environment"
  edge:1-n_verify_prod-n_announce: "#lane-communication"
  edge:1-n_checks-n_failed: "#lane-exceptions"
  edge:1-n_verify_prod-n_rollback: "#lane-exceptions"
  edge:1-n_rollback-n_deploy: "#lane-exceptions"
```

:::

## 阅读重点 {#overview}

提交与 Pull Request 经构建、质量门禁和人工审批后进入灰度发布；生产验证健康才通知发布完成。门禁失败停止晋级，生产验证失败则进入 Rollback，再恢复到 Deploy。

原例把审批、不可变镜像和检查结果作为发布证据。

通知不是生产成功的判定节点；健康验证和回滚责任都在图中显式保留。

## 三个发布阶段 {#phases}

Change 包含提交与评审；Build + verify 包含可复现构建和阻断检查；Promote + observe 包含人工审批、生产发布和健康观察。横向表示阶段推进，纵向表示责任交接；六条泳道保持独立，失败与恢复路径放在异常泳道。

## Developer {#lane-dev}

开发者负责签名提交和经过评审的差异；Merge 关系才把输入交给 CI。

## Continuous Integration {#lane-ci}

构建强调锁定输入，Quality Gates 同时覆盖测试和扫描。红色失败分支进入 Stop Release。

## Release Governance {#lane-approval}

Release Owner 承担明确的人工批准责任，和自动质量检查分开。

## Production Environment {#lane-environment}

Deploy 从 canary 10% 开始，Verify 用 smoke 与 SLO 检查生产健康；回滚可以重新进入 Deploy。

## Release Communication {#lane-communication}

Announce 位于健康验证之后，发布状态与说明以验证结果为依据。

## Failure + Rollback {#lane-exceptions}

Stop Release 处理门禁失败并停止晋级；生产 Verify 失败进入 Rollback，由 on-call 使用 last good image 执行恢复。restore 回边通过独立的返回通道重新进入 Deploy，与向下的发布主线区分。

## 来源

- [release-delivery.workflow.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/release-delivery.workflow.json)，固定提交 `7e45f36c66de`。
