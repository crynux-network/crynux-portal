<script setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {Grid} from 'ant-design-vue'
import networkAPI from '@/api/v1/network'
import incentivesAPI from "@/api/v1/incentives";
import GithubButton from 'vue-github-button'
import NetworkIncentivesLineChart from "@/components/network-incentives-line-chart.vue";
import TaskNumberLineChart from "@/components/task-number-line-chart.vue";
import NodeIncentivesChart from "@/components/node-incentives-chart.vue";
import v1 from '@/api/v1/v1'
import config from '@/config.json'

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const selectedNetwork = ref('dymension')
const networks = [
    { value: 'dymension', logo: '/dymension.png' },
    { value: 'near', logo: '/near.png' }
]

const handleNetworkChange = async (value) => {
    selectedNetwork.value = value

    v1.setBaseURL(config.base_url[value])

    await loadNetworkInfo()
    totalIncentives.value = await incentivesAPI.getIncentivesTotal();
}

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
    totalNodes: 0,
    activeNodes: 0,
    busyNodes: 0,
});

const allTaskNumbers = reactive({
    totalTasks: 0,
    runningTasks: 0,
    queuedTasks: 0
});

const nodeList = ref([]);
const nodeListPageSize = 100;
const nodeListCurrentPage = ref(1);
const totalComputingPower = ref(0);

const loadNetworkInfo = async () => {

    const netInfo = await networkAPI.getNetworkInfo();
    totalComputingPower.value = netInfo.tflops;

    const nodeNums = await networkAPI.getAllNodesNumber();
    allNodeNumbers.totalNodes = nodeNums.all_nodes;
    allNodeNumbers.activeNodes = nodeNums.active_nodes;
    allNodeNumbers.busyNodes = nodeNums.busy_nodes;

    // Fix the number temporarily due to previously accumulated calculation error in smart contract.
    allNodeNumbers.busyNodes -= 200;

    const taskNums = await networkAPI.getAllTasksNumber();

    allTaskNumbers.totalTasks = taskNums.total_tasks;
    allTaskNumbers.runningTasks = taskNums.running_tasks;
    allTaskNumbers.queuedTasks = taskNums.queued_tasks;

    if (allNodeNumbers.totalNodes !== 0) {
        await loadNodeList(1, nodeListPageSize);
    }
};

const loadNodeList = async (page, pageSize) => {
    nodeList.value = await networkAPI.getAllNodesData((page - 1) * pageSize, pageSize);
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
        key: 'balance'
    },
    {
        title: 'Staking',
        key: 'staking'
    }
];

const toEtherValue = (bigNum) => {
    if (bigNum === 0) return 0

    const decimals = (bigNum / BigInt(1e18)).toString()

    let fractions = ((bigNum / BigInt(1e16)) % 100n).toString()

    if (fractions.length === 1) fractions += '0'

    return decimals + '.' + fractions
}

let totalIncentives = ref(0)

onMounted(async () => {
    await loadNetworkInfo();
    totalIncentives.value = await incentivesAPI.getIncentivesTotal();
})
</script>

<template>
    <a-row :class="topRowClasses"></a-row>
    <a-row :gutter="[16, 16]">
        <a-col :span="6" :offset="2">
            <a-card title="Total Computing Power" :bordered="false" style="height: 100%; opacity: 0.9">
                <a-statistic
                    :value="totalComputingPower"
                    :precision="0"
                    class="demo-class"
                    :value-style="{ color: '#1677ff', 'font-size': '56px', 'text-align': 'center', 'margin-top': '30px' }"
                >
                    <template #suffix>
                        <span style="margin-left:6px; color: #666666; font-size: 20px">TFLOPS</span>
                    </template>
                </a-statistic>
            </a-card>
        </a-col>
        <a-col :span="14">
            <a-card title="Crynux Network Info" :bordered="false" style="height: 100%; opacity: 0.9">
                <a-descriptions
                    :column="5"
                    bordered
                    :label-style="{'width': '160px'}"
                >
                    <a-descriptions-item label="Network Name" :span="3">Crynux Network</a-descriptions-item>
                    <a-descriptions-item label="Blockchain" :span="2">Dymension</a-descriptions-item>
                    <a-descriptions-item label="Network Version" :span="5">Helium (Incentivized Testnet)</a-descriptions-item>
                    <a-descriptions-item label="Node Version" :span="5">v2.5.0</a-descriptions-item>
                </a-descriptions>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="20" :offset="2">
            <a-card title="Nodes and Tasks" :bordered="false" style="height: 100%; opacity: 0.9">
                <a-row :gutter="[8, 8]">
                    <a-col :span="4">
                        <a-statistic :value="allNodeNumbers.totalNodes" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Total Nodes</div>
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="4">
                        <a-statistic :value="allTaskNumbers.totalTasks" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Total Tasks</div>
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="4">
                        <a-statistic :precision="0" :value="totalIncentives" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Total Incentives</div>
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="4">
                        <a-statistic :value="allNodeNumbers.activeNodes" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Active Nodes</div>
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="4">
                        <a-statistic :value="allTaskNumbers.queuedTasks" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Queued Tasks</div>
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="4">
                        <a-statistic :value="allTaskNumbers.runningTasks" :value-style="{'text-align':'center'}">
                            <template #title>
                                <div style="text-align: center">Running Tasks</div>
                            </template>
                        </a-statistic>
                    </a-col>

                </a-row>

            </a-card>
        </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="10" :offset="2">
            <a-card title="Task Count" :bordered="false" style="height: 100%; opacity: 0.9">
                <task-number-line-chart></task-number-line-chart>
            </a-card>
        </a-col>
        <a-col :span="10">
            <a-card title="Network Incentives" :bordered="false" style="height: 100%; opacity: 0.9">
                <network-incentives-line-chart></network-incentives-line-chart>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="20" :offset="2">
            <a-card title="Top Incentivized Nodes" :bordered="false" style="height: 100%; opacity: 0.9">
                <node-incentives-chart></node-incentives-chart>
            </a-card>
        </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="20" :offset="2">
            <a-card title="Crynux Node List" :bordered="false" style="height: 100%; opacity: 0.9; padding-bottom: 32px">
                <a-empty v-if="nodeList.length === 0"></a-empty>
                <a-space
                    v-if="nodeList.length !== 0"
                    direction="vertical"
                    :style="{'width': '100%'}"
                    size="large"
                >
                    <a-table
                        :columns="nodeListColumns"
                        :data-source="nodeList"
                        :pagination="false">
                        <template #bodyCell="{ column, record }">
                            <template v-if="column.key === 'address'">
                                    {{ record.address }}
                            </template>
                            <template v-else-if="column.key === 'card_model'">
                                <span>{{ record.card_model }}</span>
                            </template>
                            <template v-else-if="column.key === 'v_ram'">
                                <span>{{ record.v_ram }} GB</span>
                            </template>
                            <template v-else-if="column.key === 'balance'">
                                    CNX {{ toEtherValue(record.balance) }}
                            </template>
                            <template v-else-if="column.key === 'staking'">
                                    CNX 400.00
                            </template>
                        </template>
                    </a-table>
                    <a-pagination
                        :hide-on-single-page="true"
                        v-model:current="nodeListCurrentPage"
                        :pageSize="nodeListPageSize"
                        :total="allNodeNumbers.totalNodes"
                        :showSizeChanger="false"
                        @change="loadNodeList"
                        :style="{'float':'right'}"
                    ></a-pagination>
                </a-space>
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
                    <a-typography-link href="https://blog.crynux.ai" target="_blank">Blog</a-typography-link>
                    &nbsp;|&nbsp;
                    <a-typography-link href="https://twitter.com/crynuxai" target="_blank"
                    >Twitter
                    </a-typography-link
                    >
                    &nbsp;|&nbsp;
                    <a-typography-link href="https://discord.gg/Ug2AHUbrrm" target="_blank"
                    >Discord
                    </a-typography-link
                    >
                    &nbsp;|&nbsp;
                    <!-- Place this tag where you want the button to render. -->
                    <github-button
                        href="https://github.com/crynux-ai/crynux-node"
                        data-color-scheme="no-preference: light; light: light; dark: light;"
                        data-show-count="true" aria-label="Star Crynux Node on GitHub"
                        :style="{'position': 'relative', 'top': '4px'}"
                    >Star
                    </github-button>
                </a-space>
                <img class="footer-logo" src="./logo-full-white.png" width="140" alt="Crynux logo"/>
            </div>
        </a-col>
    </a-row>


</template>

<style lang="stylus">
.ant-row
    margin-left 0 !important
    margin-right 0 !important
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
