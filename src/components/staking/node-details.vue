<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { Typography as ATypography } from 'ant-design-vue'

const route = useRoute()
const nodeAddress = computed(() => route.params.address)
</script>

<template>
  <div class="node-details">
    <a-typography-title :level="3">Node Details</a-typography-title>
    <a-typography-paragraph>
      <a-typography-text strong>Address: </a-typography-text>
      <a-typography-text copyable>{{ nodeAddress }}</a-typography-text>
    </a-typography-paragraph>
  </div>
</template>

<style scoped>
.node-details {
  min-height: 200px;
  padding: 24px;
}
</style>
