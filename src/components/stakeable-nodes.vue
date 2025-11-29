<script setup>
import {
  TypographyTitle as ATypographyTitle,
  TypographyParagraph as ATypographyParagraph,
  Empty as AEmpty
} from 'ant-design-vue'
</script>

<template>
  <div class="stakeable-nodes-container">
    <a-typography-title :level="2" style="color: white">Stakeable Nodes</a-typography-title>
    <a-empty description="Content coming soon..." :image-style="{ height: '60px' }">
      <template #description>
        <span style="color: rgba(255, 255, 255, 0.65)">Content coming soon...</span>
      </template>
    </a-empty>
  </div>
</template>

<style scoped>
.stakeable-nodes-container {
  padding: 50px;
  text-align: center;
}
</style>
