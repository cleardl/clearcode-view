<script setup lang="ts">
import type { ReadingSection } from '../core/model.js';
defineProps<{ title: string; section?: ReadingSection; link?: string; hiddenSelection?: boolean }>();
</script>

<template>
  <aside class="ccv-inspector" aria-label="图形解读">
    <div class="ccv-inspector-heading"><span class="ccv-eyebrow">对照阅读</span><h3>{{ title }}</h3></div>
    <p v-if="hiddenSelection" class="ccv-notice">关注的对象位于收起的分组中。点击该分组的加号可以展开。</p>
    <div v-if="section" class="ccv-prose" v-html="section.html" />
    <p v-else class="ccv-empty">{{ title === '图形解读' ? '选择图中对象，查看职责与设计说明。' : '该对象未提供详细解读。' }}</p>
    <a v-if="link" class="ccv-document-link" :href="link">打开关联文档 →</a>
  </aside>
</template>
