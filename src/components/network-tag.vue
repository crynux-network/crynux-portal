<script setup>
import { computed } from 'vue'
import { Tag as ATag } from 'ant-design-vue'
import { getNetworkColor } from '@/services/network-config'

const props = defineProps({
  text: {
    type: String,
    default: ''
  }
})

const color = computed(() => {
  return getNetworkColor(props.text)
})
</script>

<template>
  <a-tag :color="color">
    <slot>{{ text }}</slot>
  </a-tag>
  </template>

<style scoped>
</style>
