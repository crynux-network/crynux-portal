<script setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {Grid} from 'ant-design-vue'
import { useRouter, useRoute } from 'vue-router'
import networkAPI from '@/api/v1/network'
import incentivesAPI from "@/api/v1/incentives";
import v2NetworkAPI from '@/api/v2/network'
import GithubButton from 'vue-github-button'
import NetworkIncentivesLineChart from "@/components/network-incentives-line-chart.vue";
import TaskNumberLineChart from "@/components/task-number-line-chart.vue";
import NodeIncentivesChart from "@/components/node-incentives-chart.vue";
import v1 from '@/api/v1/v1'
import v2 from '@/api/v2/v2'
import config from '@/config.json'

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const router = useRouter()
const route = useRoute()

const selectedNetwork = ref('dymension')
const networks = [
    { value: 'dymension', logo: '/dymension.png' },
    { value: 'near', logo: '/near.png' },
    { value: 'kasplex', logo: '/kasplex.png' }
]

const handleNetworkChange = async (value) => {
    v1.setBaseURL(config.base_url[value])
    v2.setBaseURL(config.base_url[value])
    selectedNetwork.value = value
    router.push({ name: 'network', params: { network: value } })

    await loadNetworkInfo()
    totalIncentives.value = await incentivesAPI.getIncentivesTotal();
}

const showNetworkDropdown = ref(false)

const toggleNetworkDropdown = () => {
    showNetworkDropdown.value = !showNetworkDropdown.value
}

const selectNetwork = async (network) => {
    showNetworkDropdown.value = false
    await handleNetworkChange(network.value)
}

// Get the current network logo with fallback
const currentNetworkLogo = computed(() => {
    const network = networks.find(n => n.value === selectedNetwork.value)
    return network ? network.logo : networks[0].logo
})

// close dropdown when clicking outside
const closeDropdown = (event) => {
    const selector = document.querySelector('.network-selector')
    if (selector && !selector.contains(event.target)) {
        showNetworkDropdown.value = false
    }
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

    const taskNums = await networkAPI.getAllTasksNumber();

    allTaskNumbers.totalTasks = taskNums.total_tasks;
    allTaskNumbers.runningTasks = taskNums.running_tasks;
    allTaskNumbers.queuedTasks = taskNums.queued_tasks;

    if (allNodeNumbers.totalNodes === 0) {
        nodeList.value = []; // Clear node list directly if no nodes
    } else {
        // Only call loadNodeList if there are nodes to fetch
        await loadNodeList(1, nodeListPageSize);
    }
};

const loadNodeList = async (page, pageSize) => {
    const nodesData = await v2NetworkAPI.getAllNodesData((page - 1) * pageSize, pageSize);
    if (Array.isArray(nodesData)) {
        nodeList.value = nodesData;
    } else {
        // If nodesData is not an array (e.g., null, or an object like {nodes: null}),
        // set nodeList to an empty array to ensure the table updates correctly
        // and the empty state can be shown.
        nodeList.value = [];
    }
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
        title: 'Balance',
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
    // Set initial network from route parameter if present
    const network = route.params.network
    if (network && networks.some(n => n.value === network)) {
        await handleNetworkChange(network)
    } else {
        await loadNetworkInfo()
        totalIncentives.value = await incentivesAPI.getIncentivesTotal()
    }
    document.addEventListener('click', closeDropdown)
})
</script>

<template>
    <a-row :class="topRowClasses">
        <div class="network-selector-container">
            <div class="network-selector" @click.stop="toggleNetworkDropdown">
                <img :src="currentNetworkLogo" alt="Network Logo" class="network-logo">
                <div class="dropdown-arrow">▼</div>
                <div class="network-dropdown" v-if="showNetworkDropdown">
                    <div
                        v-for="network in networks"
                        :key="network.value"
                        class="network-option"
                        @click.stop="selectNetwork(network)"
                    >
                        <img :src="network.logo" :alt="network.value" class="network-option-logo">
                    </div>
                </div>
            </div>
        </div>
    </a-row>
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
                    <a-descriptions-item label="Blockchain" :span="2">{{ selectedNetwork.charAt(0).toUpperCase() + selectedNetwork.slice(1) }}</a-descriptions-item>
                    <a-descriptions-item label="Network Version" :span="5">Helium (Incentivized Testnet)</a-descriptions-item>
                    <a-descriptions-item label="Node Version" :span="5">v2.6.0</a-descriptions-item>
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
                <task-number-line-chart :network="selectedNetwork"></task-number-line-chart>
            </a-card>
        </a-col>
        <a-col :span="10">
            <a-card title="Network Incentives" :bordered="false" style="height: 100%; opacity: 0.9">
                <network-incentives-line-chart :network="selectedNetwork"></network-incentives-line-chart>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="20" :offset="2">
            <a-card title="Top Incentivized Nodes" :bordered="false" style="height: 100%; opacity: 0.9">
                <node-incentives-chart :network="selectedNetwork"></node-incentives-chart>
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
                                <span>{{ record.card_model.split('+')[0] }}</span>
                            </template>
                            <template v-else-if="column.key === 'v_ram'">
                                <span>{{ record.v_ram }} GB</span>
                            </template>
                            <template v-else-if="column.key === 'balance'">
                                    CNX {{ toEtherValue(BigInt(record.balance)) }}
                            </template>
                            <template v-else-if="column.key === 'staking'">
                                    CNX {{ toEtherValue(BigInt(record.staking)) }}
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
                    <a-typography-link href="https://crynux.io" target="_blank">Home</a-typography-link>
                    &nbsp;|&nbsp;
                    <a-typography-link href="https://docs.crynux.io" target="_blank">Docs</a-typography-link>
                    &nbsp;|&nbsp;
                    <a-typography-link href="https://blog.crynux.io" target="_blank">Blog</a-typography-link>
                    &nbsp;|&nbsp;
                    <a-typography-link href="https://x.com/crynuxio" target="_blank"
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
                        href="https://github.com/crynux-network/crynux-node"
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
.network-selector-container
    position absolute
    top 20px
    right 40px
    z-index 10

.network-selector
    position relative
    cursor pointer
    background-color rgba(0, 0, 0, 0.4)
    border-radius 12px
    padding 8px 16px
    display flex
    align-items center

.network-logo
    height 30px
    display block

.dropdown-arrow
    margin-left 8px
    font-size 10px
    color white
    opacity 0.8

.network-dropdown
    position absolute
    top 100%
    right 0
    margin-top 8px
    background-color rgba(0, 0, 0, 0.7)
    border-radius 8px
    padding 8px
    min-width 100%

.network-option
    padding 8px
    border-radius 6px
    transition background-color 0.2s

    &:hover
        background-color rgba(255, 255, 255, 0.1)

    &:not(:last-child)
        margin-bottom 8px

.network-option-logo
    height 30px
    display block

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
    position relative
    height 80px
</style>
