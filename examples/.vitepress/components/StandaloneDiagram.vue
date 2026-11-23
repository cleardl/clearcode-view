<script setup lang="ts">
import { createDiagram } from '../../../src/core.js';
import { DiagramView } from '../../../src/vue.js';

const model = createDiagram({
  id: 'direct-mermaid',
  source: `flowchart LR
  client["Client"]:::ccv-frontend
  subgraph runtime["Runtime"]
    gateway["Gateway"]:::ccv-backend
    worker["Worker"]:::ccv-backend
  end
  client submit@--> gateway
  gateway dispatch@--> worker`,
  overview: '#overview',
  details: { 'node:client': '#input', 'node:gateway': '#runtime', 'node:worker': '#runtime', 'group:runtime': '#runtime', 'edge:submit': '#input', 'edge:dispatch': '#runtime' },
  sections: {
    '#overview': { ref: '#overview', title: '独立 Mermaid 输入', html: '<p>这个组件直接接收 Mermaid 源码与阅读关联，没有调用 Markdown 编译器。</p><p>选择节点或连线可查看说明；分组通过加减号展开和收起。</p>' },
    '#input': { ref: '#input', title: '请求接纳', html: '<p>Client 将请求交给 Gateway，接纳请求与执行工作分别承担职责。</p>' },
    '#runtime': { ref: '#runtime', title: '运行时分派', html: '<p>Gateway 将工作分派给 Worker。选中运行时分组只更新解读；只有点击加减号才改变折叠状态。</p>' },
  },
});
</script>

<template><DiagramView :model="model" /></template>
