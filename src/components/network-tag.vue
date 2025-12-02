<script setup>
import { computed } from 'vue'
import { Tag as ATag } from 'ant-design-vue'

const props = defineProps({
  text: {
    type: String,
    default: ''
  }
})

const color = computed(() => {
  const s = String(props.text || '').toLowerCase()
  if (s.includes('dym')) return 'geekblue'
  if (s.includes('near')) return 'green'
  return undefined
})
</script>

<template>
  <a-tag :color="color">
    <slot>{{ text }}</slot>
  </a-tag>
  </template>

<style scoped>
</style>
