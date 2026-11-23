# Archify 仓库结构分解

使用上游示例中的 31 个目录与文件节点，区分可安装 Skill、Viewer、网站和构建脚本。继续展开 renderers、shared 和 CLI 子树，比较源码导航的组织方式。

::: diagram id="repository-tree"

```mermaid
---
title: "Archify repository layout"
---
  %% ccv:diagram {"kind":"tree"}
flowchart LR
  n_repo["archify repository<br/>Skill, viewer, and site"]
  n_skill["archify/<br/>Installable Skill package"]
  n_viewer["viewer/<br/>Inlined into the template"]
  n_site["website/<br/>Astro project site"]
  n_scripts["scripts/<br/>Build and freshness tools"]
  n_renderers["renderers/<br/>One per diagram type"]
  n_schemas["schemas/<br/>Typed JSON contracts"]
  n_bin["bin/<br/>CLI entry points"]
  n_references["references/<br/>Authoring contracts"]
  n_r_arch["architecture/<br/>Boundaries and router"]
  n_r_workflow["workflow/<br/>Workflow compiler"]
  n_r_sequence["sequence/"]
  n_r_dataflow["dataflow/"]
  n_r_lifecycle["lifecycle/"]
  n_r_erd["erd/<br/>Crow's foot markers"]
  n_r_tree["tree/<br/>This renderer"]
  n_r_shared["shared/<br/>Shared helpers"]
  n_s_cli["cli.mjs<br/>Load, validate, write"]
  n_s_geometry["geometry.mjs<br/>Composition gates"]
  n_s_i18n["i18n.mjs<br/>Locale catalogs"]
  n_s_validators["generated-validators.mjs<br/>Schema validators"]
  n_b_archify["archify.mjs<br/>CLI: validate, finalize"]
  n_b_finalize["finalize.mjs<br/>Render, check, deliver"]
  n_b_preview["preview.mjs<br/>Live preview server"]
  n_v_focus["focus.js<br/>Semantic passport"]
  n_v_export["export.js<br/>SVG, PNG, WebM export"]
  n_v_tree["tree-branches.js<br/>Expand and collapse"]
  n_v_camera["viewer-camera.js<br/>Pan, zoom, reveal"]
  n_sc_viewer["generate-viewer.mjs<br/>Inlines viewer/"]
  n_sc_zip["build-zip.sh<br/>Deterministic archive"]
  n_sc_gallery["build-gallery.mjs"]
  n_repo contains_n_skill@--> n_skill
  n_repo contains_n_viewer@--> n_viewer
  n_repo contains_n_site@--> n_site
  n_repo contains_n_scripts@--> n_scripts
  n_skill contains_n_renderers@--> n_renderers
  n_skill contains_n_schemas@--> n_schemas
  n_skill contains_n_bin@--> n_bin
  n_skill contains_n_references@--> n_references
  n_renderers contains_n_r_arch@--> n_r_arch
  n_renderers contains_n_r_workflow@--> n_r_workflow
  n_renderers contains_n_r_sequence@--> n_r_sequence
  n_renderers contains_n_r_dataflow@--> n_r_dataflow
  n_renderers contains_n_r_lifecycle@--> n_r_lifecycle
  n_renderers contains_n_r_erd@--> n_r_erd
  n_renderers contains_n_r_tree@--> n_r_tree
  n_renderers contains_n_r_shared@--> n_r_shared
  n_r_shared contains_n_s_cli@--> n_s_cli
  n_r_shared contains_n_s_geometry@--> n_s_geometry
  n_r_shared contains_n_s_i18n@--> n_s_i18n
  n_r_shared contains_n_s_validators@--> n_s_validators
  n_bin contains_n_b_archify@--> n_b_archify
  n_bin contains_n_b_finalize@--> n_b_finalize
  n_bin contains_n_b_preview@--> n_b_preview
  n_viewer contains_n_v_focus@--> n_v_focus
  n_viewer contains_n_v_export@--> n_v_export
  n_viewer contains_n_v_tree@--> n_v_tree
  n_viewer contains_n_v_camera@--> n_v_camera
  n_scripts contains_n_sc_viewer@--> n_sc_viewer
  n_scripts contains_n_sc_zip@--> n_sc_zip
  n_scripts contains_n_sc_gallery@--> n_sc_gallery








```

```diagram-view
version: 1
overview: "#overview"
details:
  node:n_repo: "#overview"
  node:n_skill: "#branch-skill"
  node:n_viewer: "#branch-viewer"
  node:n_site: "#branch-site"
  node:n_scripts: "#branch-scripts"
  node:n_renderers: "#branch-skill"
  node:n_schemas: "#branch-skill"
  node:n_bin: "#branch-skill"
  node:n_references: "#branch-skill"
  node:n_r_arch: "#branch-skill"
  node:n_r_workflow: "#branch-skill"
  node:n_r_sequence: "#branch-skill"
  node:n_r_dataflow: "#branch-skill"
  node:n_r_lifecycle: "#branch-skill"
  node:n_r_erd: "#branch-skill"
  node:n_r_tree: "#branch-skill"
  node:n_r_shared: "#branch-skill"
  node:n_s_cli: "#branch-skill"
  node:n_s_geometry: "#branch-skill"
  node:n_s_i18n: "#branch-skill"
  node:n_s_validators: "#branch-skill"
  node:n_b_archify: "#branch-skill"
  node:n_b_finalize: "#branch-skill"
  node:n_b_preview: "#branch-skill"
  node:n_v_focus: "#branch-viewer"
  node:n_v_export: "#branch-viewer"
  node:n_v_tree: "#branch-viewer"
  node:n_v_camera: "#branch-viewer"
  node:n_sc_viewer: "#branch-scripts"
  node:n_sc_zip: "#branch-scripts"
  node:n_sc_gallery: "#branch-scripts"
  edge:contains_n_skill: "#branch-skill"
  edge:contains_n_viewer: "#branch-viewer"
  edge:contains_n_site: "#branch-site"
  edge:contains_n_scripts: "#branch-scripts"
  edge:contains_n_renderers: "#branch-skill"
  edge:contains_n_schemas: "#branch-skill"
  edge:contains_n_bin: "#branch-skill"
  edge:contains_n_references: "#branch-skill"
  edge:contains_n_r_arch: "#branch-skill"
  edge:contains_n_r_workflow: "#branch-skill"
  edge:contains_n_r_sequence: "#branch-skill"
  edge:contains_n_r_dataflow: "#branch-skill"
  edge:contains_n_r_lifecycle: "#branch-skill"
  edge:contains_n_r_erd: "#branch-skill"
  edge:contains_n_r_tree: "#branch-skill"
  edge:contains_n_r_shared: "#branch-skill"
  edge:contains_n_s_cli: "#branch-skill"
  edge:contains_n_s_geometry: "#branch-skill"
  edge:contains_n_s_i18n: "#branch-skill"
  edge:contains_n_s_validators: "#branch-skill"
  edge:contains_n_b_archify: "#branch-skill"
  edge:contains_n_b_finalize: "#branch-skill"
  edge:contains_n_b_preview: "#branch-skill"
  edge:contains_n_v_focus: "#branch-viewer"
  edge:contains_n_v_export: "#branch-viewer"
  edge:contains_n_v_tree: "#branch-viewer"
  edge:contains_n_v_camera: "#branch-viewer"
  edge:contains_n_sc_viewer: "#branch-scripts"
  edge:contains_n_sc_zip: "#branch-scripts"
  edge:contains_n_sc_gallery: "#branch-scripts"
```

:::

## 阅读重点 {#overview}

使用上游示例中的 31 个目录与文件节点，区分可安装 Skill、Viewer、网站和构建脚本。继续展开 renderers、shared 和 CLI 子树，比较源码导航的组织方式。

本页描述的是该提交附带的 Archify 源示例，不是 clearcode-view 自身的目录。

原版 viewer 分支初始收起；本版完整展示同一组节点，便于核对全部路径。

## archify/ {#branch-skill}

archify/ 是可安装的 Skill 包，容纳渲染器、Schema、CLI 和 authoring references。

## viewer/ {#branch-viewer}

viewer/ 管理语义聚焦、导出、树分支与镜头，最终内联到模板。

## website/ {#branch-site}

website/ 是 Astro 项目站点，和生成图形的运行时职责分开。

## scripts/ {#branch-scripts}

scripts/ 保存 Viewer 生成、归档和图库等构建与时效检查工具。

## 来源

- [archify-repository.tree.json](https://github.com/tt-a1i/archify/blob/7e45f36c66de1254d5ad6ba1d878f6499ea269fd/archify/examples/archify-repository.tree.json)，固定提交 `7e45f36c66de`。
