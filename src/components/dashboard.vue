<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Grid } from 'ant-design-vue'
import networkAPI from '@/api/v1/network'

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

const allNodeNumbers = reactive({
    allNodes: 0,
    availableNodes: 0
});

const nodeList = ref([]);
const nodeListPageSize = 20;
const nodeListCurrentPage = 0;
const nodeListTotalPages = computed(() => {
    return Math.floor(nodeList.value.length / nodeListPageSize);
});

const loadNetworkInfo = async () => {
    const nodeNums = await networkAPI.getAllNodesNumber();
    allNodeNumbers.allNodes = nodeNums.all_nodes;
    allNodeNumbers.availableNodes = nodeNums.available_nodes;

    if (allNodeNumbers.allNodes !== 0) {
        await loadNodeList(0, nodeListPageSize);
    }
};

const loadNodeList = async (page, pageSize) => {
    nodeList.value = await networkAPI.getAllNodesData(page * pageSize, pageSize);
};

const nodeListColumns = [
    {
        title: 'Address',
        key: 'address',
    },
    {
        title: 'Card Model',
        key: 'card_model',
    },
    {
        title: 'VRAM',
        key: 'vram',
    },
    {
        title: 'CNX Balance',
        key:'cnx_balance'
    }
];

onMounted(async () => {
    await loadNetworkInfo();
})
</script>

<template>
  <a-row :class="topRowClasses"> </a-row>
  <a-row :gutter="[16, 16]">
    <a-col :span="20" :offset="2">
      <a-card title="Crynux Network Statistics" :bordered="false" style="height: 100%; opacity: 0.9">
          <a-row :gutter="[8, 8]">
              <a-col :span="8">
                  <a-statistic :value="allNodeNumbers.allNodes" :value-style="{'text-align':'center'}">
                      <template #title>
                          <div style="text-align: center">Total Nodes</div>
                      </template>
                  </a-statistic>
              </a-col>
              <a-col :span="8">
                  <a-statistic :value="allNodeNumbers.availableNodes" :value-style="{'text-align':'center'}">
                      <template #title>
                          <div style="text-align: center">Available Nodes</div>
                      </template>
                  </a-statistic>
              </a-col>
              <a-col :span="8">
                  <a-statistic :value="allNodeNumbers.allNodes - allNodeNumbers.availableNodes" :value-style="{'text-align':'center'}">
                      <template #title>
                          <div style="text-align: center">Busy Nodes</div>
                      </template>
                  </a-statistic>
              </a-col>
          </a-row>
      </a-card>
    </a-col>
  </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="20" :offset="2">
            <a-card title="Crynux Node List" :bordered="false" style="height: 100%; opacity: 0.9">
                <a-empty v-if="nodeList.length === 0"></a-empty>
                <a-table v-if="nodeList.length !== 0" :columns="nodeListColumns" :data-source="nodeList">

                </a-table>
                <a-pagination
                    v-if="nodeListTotalPages > 1"
                    v-model:current="nodeListCurrentPage"
                    :total="nodeList.length"
                    :page-size="nodeListPageSize"
                    @change="loadNodeList"
                />
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
