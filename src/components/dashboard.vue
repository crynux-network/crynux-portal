<script setup>
import {computed, onBeforeUnmount, onMounted, reactive, ref, watch} from 'vue'
import { Grid } from 'ant-design-vue'
import networkAPI from '@/api/v1/network'
import config from '@/config.json'

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
const nodeListCurrentPage = ref(0);

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
        key: 'v_ram',
    },
    {
        title: 'CNX Balance',
        key:'cnx_balance'
    },
    {
        title: 'Collateral',
        key: 'collateral'
    }
];

const toEtherValue = (bigNum) => {
    if (bigNum === 0) return 0

    const decimals = (bigNum / BigInt(1e18)).toString()

    let fractions = ((bigNum / BigInt(1e16)) % 100n).toString()

    if (fractions.length === 1) fractions += '0'

    return decimals + '.' + fractions
}

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
            <a-card title="Crynux Node List" :bordered="false" style="height: 100%; opacity: 0.9; padding-bottom: 32px">
                <a-empty v-if="nodeList.length === 0"></a-empty>
                <a-table
                    v-if="nodeList.length !== 0"
                    :columns="nodeListColumns"
                    :data-source="nodeList"
                    :pagination="{
                        'hideOnSinglePage': true,
                        'v-model:current': nodeListCurrentPage + 1,
                        'pageSize': nodeListPageSize,
                        'total': allNodeNumbers.allNodes,
                        'change': loadNodeList
                    }">
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'address'">
                            <a-typography-link :href="config.block_explorer + '/address/' + record.address" target="_blank">
                              {{ record.address }}
                            </a-typography-link>
                        </template>
                        <template v-else-if="column.key === 'card_model'">
                            <span>{{ record.card_model }}</span>
                        </template>
                        <template v-else-if="column.key === 'v_ram'">
                            <span>{{ record.v_ram }} GB</span>
                        </template>
                        <template v-else-if="column.key === 'cnx_balance'">
                            <a-typography-link :href="config.block_explorer + '/address/' + record.address + '/tokens'" target="_blank">
                                CNX {{ toEtherValue(record.cnx_balance) }}
                            </a-typography-link>
                        </template>
                        <template v-else-if="column.key === 'collateral'">
                            <a-typography-link :href="config.block_explorer + '/address/' + record.address + '/tokens'" target="_blank">
                                CNX 400.00
                            </a-typography-link>
                        </template>
                    </template>
                </a-table>
            </a-card>
        </a-col>
    </a-row>
    <a-row style="margin-top: 16px">
        <a-col :span="20" :offset="2">
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
        </a-col>
    </a-row>


</template>

<style lang="stylus">
.ant-row
    margin-left 0!important
    margin-right 0!important
</style>
<style scoped lang="stylus">
.bottom-bar
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
