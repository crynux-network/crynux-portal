<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { Grid } from 'ant-design-vue'

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const topRowClasses = computed(() => {
    let classes = ['top-row']
    for (let v in screens.value) {
        if (screens.value[v]) {
            classes.push(v)
        }
    }

    return classes
})

onMounted(async () => {

})

onBeforeUnmount(() => {

})
</script>

<template>
  <a-row :class="topRowClasses"> </a-row>
  <a-row :gutter="[16, 16]">
    <a-col
      :xs="{ span: 24, offset: 0, order: 1 }"
      :sm="{ span: 12, offset: 0, order: 1 }"
      :md="{ span: 12, offset: 0, order: 1 }"
      :lg="{ span: 5, offset: 0, order: 1 }"
      :xl="{ span: 5, offset: 1, order: 1 }"
      :xxl="{ span: 4, offset: 3, order: 1 }"
    >
      <a-card title="Node Status" :bordered="false" style="height: 100%; opacity: 0.9">

      </a-card>
    </a-col>

    <a-col
      :xs="{ span: 24, order: 3 }"
      :sm="{ span: 24, order: 3 }"
      :md="{ span: 24, order: 3 }"
      :lg="{ span: 12, order: 2 }"
      :xl="{ span: 11, order: 2 }"
      :xxl="{ span: 9, order: 2 }"
    >
      <a-card title="Wallet" :bordered="false" style="height: 100%; opacity: 0.9">

      </a-card>
    </a-col>

    <a-col
      :xs="{ span: 24, order: 2 }"
      :sm="{ span: 12, order: 2 }"
      :md="{ span: 12, order: 2 }"
      :lg="{ span: 7, order: 3 }"
      :xl="{ span: 6, order: 3 }"
      :xxl="{ span: 5, order: 3 }"
    >
      <a-card title="Task Execution" :bordered="false" style="height: 100%; opacity: 0.9">

      </a-card>
    </a-col>
  </a-row>

  <div class="bottom-bar">
    <a-space class="footer-links">
      <a-typography-link href="https://crynux.ai" target="_blank">Home</a-typography-link>
      &nbsp;|&nbsp;
      <a-typography-link href="https://docs.crynux.ai" target="_blank">Docs</a-typography-link>
      &nbsp;|&nbsp;
      <a-typography-link href="https://github.com/crynux-ai" target="_blank"
        >GitHub</a-typography-link
      >
      &nbsp;|&nbsp;
      <a-typography-link href="https://blog.crynux.ai" target="_blank">Blog</a-typography-link>
      &nbsp;|&nbsp;
      <a-typography-link href="https://twitter.com/crynuxai" target="_blank"
        >Twitter</a-typography-link
      >
      &nbsp;|&nbsp;
      <a-typography-link href="https://discord.gg/Ug2AHUbrrm" target="_blank"
        >Discord</a-typography-link
      >
    </a-space>
    <img class="footer-logo" src="./logo-full-white.png" width="140" alt="Crynux logo" />
  </div>
</template>

<style lang="stylus">
.ant-row
    margin-left 0!important
    margin-right 0!important
</style>
<style scoped lang="stylus">
.bottom-bar
    position fixed
    width 100%
    height 60px
    bottom 0
    left 0
    padding 0 32px

.footer-links
    color #fff
    opacity 0.8
    line-height 60px

    a
        color #fff
        &:hover
            text-decoration underline

.footer-logo
    opacity 0.8
    float right

.top-row
    &.xs
        height 16px
    &.sm
        height 20px
    &.md
        height 40px
    &.lg
        height 40px
    &.xl
        height 80px
    &.xxl
        height 100px
</style>
