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

import {
    TeamOutlined,
    ProfileOutlined,
    DollarCircleOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    PlayCircleOutlined
} from '@ant-design/icons-vue'

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const statisticValueStyle = computed(() => {
    const fontSize = screens.value.xs ? '36px' : '56px'
    return {
        color: '#1677ff',
        'font-size': fontSize,
        'text-align': 'center',
        'margin-top': '30px'
    }
})

const brandBlue = computed(() => statisticValueStyle.value.color)

const kpiValueStyle = computed(() => {
    return { color: brandBlue.value }
})

const gridItemStyle = computed(() => {
    const width = screens.value.xs ? '50%' : '33.33%'
    return {
        width,
        'text-align': 'center'
    }
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
    <div class="top-spacer"></div>
    <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="24" :md="8" :lg="6">
            <a-card title="Total Computing Power" :bordered="false" style="height: 100%; opacity: 0.9">
                <a-statistic
                    :value="totalComputingPower"
                    :precision="0"
                    class="demo-class"
                    :value-style="statisticValueStyle"
                >
                    <template #suffix>
                        <span style="margin-left:6px; color: #666666; font-size: 20px">TFLOPS</span>
                    </template>
                </a-statistic>
            </a-card>
        </a-col>
        <a-col :xs="24" :sm="24" :md="16" :lg="18">
            <a-card class="nodes-tasks-card" title="Nodes and Tasks" :bordered="false" :body-style="{ padding: '16px 16px' }" style="height: 100%; opacity: 0.9; overflow: hidden">
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allNodeNumbers.totalNodes" :value-style="kpiValueStyle">
                        <template #prefix>
                            <team-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Total Nodes</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.totalTasks" :value-style="kpiValueStyle">
                        <template #prefix>
                            <profile-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Total Tasks</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :precision="0" :value="totalIncentives" :value-style="kpiValueStyle">
                        <template #prefix>
                            <dollar-circle-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Total Incentives</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allNodeNumbers.activeNodes" :value-style="kpiValueStyle">
                        <template #prefix>
                            <check-circle-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Active Nodes</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.queuedTasks" :value-style="kpiValueStyle">
                        <template #prefix>
                            <clock-circle-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Queued Tasks</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.runningTasks" :value-style="kpiValueStyle">
                        <template #prefix>
                            <play-circle-outlined :style="{ color: brandBlue, 'margin-right': '8px' }" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Running Tasks</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
            </a-card>
        </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :xs="24" :lg="12">
            <a-card title="Task Count" :bordered="false" style="height: 100%; opacity: 0.9">
                <task-number-line-chart></task-number-line-chart>
            </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
            <a-card title="Network Incentives" :bordered="false" style="height: 100%; opacity: 0.9">
                <network-incentives-line-chart></network-incentives-line-chart>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
            <a-card title="Top Incentivized Nodes" :bordered="false" style="height: 100%; opacity: 0.9">
                <node-incentives-chart></node-incentives-chart>
            </a-card>
        </a-col>
    </a-row>

    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
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
                        :pagination="false"
                        :scroll="{ x: 800 }">
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

<style scoped lang="stylus">
.top-spacer
    height 20px

:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid)
    box-shadow none !important
    border none

::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid)
    box-shadow none !important
    border none

:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:hover)
    box-shadow none !important

::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:hover)
    box-shadow none !important

/* vertical inner separators (do not touch outer edges due to body padding) */
:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(1)),
:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(2)),
:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(4)),
:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(1)),
::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(2)),
::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(4)),
::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

/* horizontal inner separator between two rows */
:deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)

::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)
</style>
