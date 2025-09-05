<script setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {Grid} from 'ant-design-vue'

import networkAPI from '@/api/v1/network'
import incentivesAPI from "@/api/v1/incentives";
import v2NetworkAPI from '@/api/v2/network'

import NetworkIncentivesLineChart from "./network-incentives-line-chart.vue";
import TaskNumberLineChart from "./task-number-line-chart.vue";
import NodeIncentivesChart from "./node-incentives-chart.vue";


import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

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
    await loadNetworkInfo()
    totalIncentives.value = await incentivesAPI.getIncentivesTotal()
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
                    <a-descriptions-item label="Network Name" :span="5">Crynux Network</a-descriptions-item>
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


</template>

<style lang="stylus">
.ant-row
    margin-left 0 !important
    margin-right 0 !important
</style>
<style scoped lang="stylus">
.top-row
    position relative
    height 20px
</style>
