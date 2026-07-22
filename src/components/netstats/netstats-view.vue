<script setup>
import {computed, onMounted, reactive, ref} from 'vue'
import {Grid, message} from 'ant-design-vue'

import cnxAPI from '@/api/cnx'
import networkAPI from '@/api/v1/network'
import v2NetworkAPI from '@/api/v2/network'
import {formatBigInt18, formatBigInt18Compact} from '@/services/token'
import {formatNetworkName, getAddressExplorerUrl} from '@/services/network-config'

import NetworkIncentivesLineChart from "./network-incentives-line-chart.vue";
import TaskNumberLineChart from "./task-number-line-chart.vue";
import TaskSuccessRateLineChart from "./task-success-rate-line-chart.vue";
import TaskDurationHistogram from "./task-duration-histogram.vue";
import NodeIncentivesChart from "./node-incentives-chart.vue";
import TopStakeableNodes from "./top-stakeable-nodes.vue";
import DelegationIncentivesChart from "./delegation-incentives-chart.vue";

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

import {
    TeamOutlined,
    ProfileOutlined,
    DollarCircleOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    PlayCircleOutlined,
    RightOutlined
} from '@ant-design/icons-vue'

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const isNarrowTwoCol = computed(() => {
    return screens.value.md && !screens.value.lg
})

const statisticValueStyle = computed(() => {
    let fontSize = '56px'
    if (screens.value.xs) {
        fontSize = '36px'
    } else if (isNarrowTwoCol.value) {
        fontSize = '32px'
    }
    return {
        color: '#1677ff',
        'font-size': fontSize,
        'text-align': 'center'
    }
})

const brandBlue = computed(() => statisticValueStyle.value.color)

const kpiValueStyle = computed(() => {
    let fontSize = '24px'
    if (isNarrowTwoCol.value) {
        fontSize = '16px'
    }
    return {
        color: brandBlue.value,
        'font-size': fontSize
    }
})

const kpiIconStyle = computed(() => {
    let fontSize = '20px'
    if (isNarrowTwoCol.value) {
        fontSize = '14px'
    }
    return {
        color: brandBlue.value,
        'margin-right': '6px',
        'font-size': fontSize
    }
})

const unitStyle = computed(() => {
    let fontSize = '20px'
    if (screens.value.xs) {
        fontSize = '16px'
    } else if (isNarrowTwoCol.value) {
        fontSize = '14px'
    }
    return {
        color: '#666666',
        'font-size': fontSize,
        'margin-top': '2px',
        'text-align': 'center'
    }
})

const totalPowerCardBodyStyle = computed(() => {
    return {
        display: 'flex',
        'flex-direction': 'column',
        'justify-content': 'center',
        'align-items': 'center',
        'flex': '1 1 auto',
        'padding-bottom': '48px'
    }
})

const gridItemStyle = computed(() => {
    const width = screens.value.md ? '33.33%' : '50%'
    return {
        width,
        'text-align': 'center'
    }
})

const nodesTasksCardClass = computed(() => {
    return ['nodes-tasks-card', screens.value.md ? 'cols-3' : 'cols-2']
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
const defaultNodeListNetwork = 'crynux-on-base'

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
    const nodesData = await v2NetworkAPI.getAllNodesData(page, pageSize);
    if (Array.isArray(nodesData)) {
        nodeList.value = nodesData;
    } else {
        // If nodesData is not an array (e.g., null, or an object like {nodes: null}),
        // set nodeList to an empty array to ensure the table updates correctly
        // and the empty state can be shown.
        nodeList.value = [];
    }
};

const formatNodeCardName = (cardModel) => String(cardModel || '').split('+')[0] || 'Unknown Card'

const getNodePlatformTag = (cardModel) => {
    const value = String(cardModel || '')
    if (value.includes('+docker')) return 'Docker'
    if (value.includes('+Windows')) return 'Windows'
    if (value.includes('+Darwin')) return 'Mac'
    if (value.includes('+Linux')) return 'Linux'
    return ''
}

const shortenNodeAddress = (address) => {
    const value = String(address || '')
    if (value.length <= 12) return value
    return `${value.substring(0, 6)}...${value.substring(value.length - 6)}`
}

const getNodeListNetwork = (record) => record.network || defaultNodeListNetwork

const getNodeExplorerUrl = (record) => getAddressExplorerUrl(getNodeListNetwork(record), record.address)

const circulation = ref('0')

const loadCirculation = async () => {
    try {
        const circulatingSupply = await cnxAPI.getCirculatingSupply()
        circulation.value = formatBigInt18(circulatingSupply, 0)
    } catch (error) {
        console.error('Failed to load CNX circulating supply', error)
        message.error('Failed to load CNX circulating supply')
    }
}

onMounted(async () => {
    await Promise.all([
        loadNetworkInfo(),
        loadCirculation()
    ])
})
</script>

<template>
    <div class="top-spacer"></div>
    <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="24" :md="8" :lg="6">
            <a-card
                title="Total Computing Power"
                :bordered="false"
                :body-style="totalPowerCardBodyStyle"
                style="height: 100%; opacity: 0.9"
                class="total-power-card"
            >
                <div style="width: 100%; text-align: center">
                    <a-statistic
                        :value="totalComputingPower"
                        :precision="0"
                        class="demo-class"
                        :value-style="statisticValueStyle"
                        :style="{ 'margin-bottom': '2px' }"
                    />
                    <div :style="unitStyle">TFLOPS</div>
                </div>
            </a-card>
        </a-col>
        <a-col :xs="24" :sm="24" :md="16" :lg="18">
            <a-card :class="nodesTasksCardClass" title="Nodes and Tasks" :bordered="false" :body-style="{ padding: '16px 16px' }" style="height: 100%; opacity: 0.9; overflow: hidden">
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allNodeNumbers.totalNodes" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <team-outlined :style="kpiIconStyle" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Total Nodes</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.totalTasks" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <profile-outlined :style="kpiIconStyle" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Total Tasks</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="circulation" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <dollar-circle-outlined :style="kpiIconStyle" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Circulation</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allNodeNumbers.activeNodes" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <check-circle-outlined :style="kpiIconStyle" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Active Nodes</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.queuedTasks" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <clock-circle-outlined :style="kpiIconStyle" />
                        </template>
                        <template #title>
                            <div style="text-align: center">Queued Tasks</div>
                        </template>
                    </a-statistic>
                </a-card-grid>
                <a-card-grid :hoverable="false" :style="gridItemStyle">
                    <a-statistic :value="allTaskNumbers.runningTasks" :value-style="kpiValueStyle" :style="{ 'white-space': 'nowrap' }">
                        <template #prefix>
                            <play-circle-outlined :style="kpiIconStyle" />
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
        <a-col :span="24">
            <a-card title="Top Stakeable Nodes" :bordered="false" style="height: 100%; opacity: 0.9">
                <template #extra>
                    <router-link to="/staking" class="more-link">More <right-outlined class="more-link-icon" /></router-link>
                </template>
                <top-stakeable-nodes></top-stakeable-nodes>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
            <a-card title="Top Stakes by Task Fee" :bordered="false" style="height: 100%; opacity: 0.9">
                <delegation-incentives-chart></delegation-incentives-chart>
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
            <a-card title="Total Task Fee" :bordered="false" style="height: 100%; opacity: 0.9">
                <network-incentives-line-chart></network-incentives-line-chart>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :xs="24" :lg="12">
            <a-card title="Task Success Rate" :bordered="false" style="height: 100%; opacity: 0.9">
                <task-success-rate-line-chart></task-success-rate-line-chart>
            </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
            <a-card title="Task Duration" :bordered="false" style="height: 100%; opacity: 0.9">
                <task-duration-histogram></task-duration-histogram>
            </a-card>
        </a-col>
    </a-row>
    <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :span="24">
            <a-card title="Top Nodes by Task Fee" :bordered="false" style="height: 100%; opacity: 0.9">
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
                    <div class="compact-node-list">
                        <div
                            v-for="record in nodeList"
                            :key="record.address"
                            class="compact-node-item"
                        >
                            <a
                                v-if="getNodeExplorerUrl(record)"
                                class="compact-node-link"
                                :href="getNodeExplorerUrl(record)"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <div class="compact-node-title">
                                    <span class="compact-node-card">{{ formatNodeCardName(record.card_model) }}</span>
                                    <a-tag v-if="getNodePlatformTag(record.card_model)" class="compact-node-tag">{{ getNodePlatformTag(record.card_model) }}</a-tag>
                                    <a-tag v-if="record.v_ram" class="compact-node-tag">{{ record.v_ram }}GB</a-tag>
                                    <a-tag class="compact-node-tag">{{ formatNetworkName(getNodeListNetwork(record)) }}</a-tag>
                                </div>
                                <div class="compact-node-meta">
                                    <span>{{ shortenNodeAddress(record.address) }}</span>
                                    <span>CNX {{ formatBigInt18Compact(record.staking) }}</span>
                                </div>
                            </a>
                            <div v-else class="compact-node-link">
                                <div class="compact-node-title">
                                    <span class="compact-node-card">{{ formatNodeCardName(record.card_model) }}</span>
                                    <a-tag v-if="getNodePlatformTag(record.card_model)" class="compact-node-tag">{{ getNodePlatformTag(record.card_model) }}</a-tag>
                                    <a-tag v-if="record.v_ram" class="compact-node-tag">{{ record.v_ram }}GB</a-tag>
                                    <a-tag class="compact-node-tag">{{ formatNetworkName(getNodeListNetwork(record)) }}</a-tag>
                                </div>
                                <div class="compact-node-meta">
                                    <span>{{ shortenNodeAddress(record.address) }}</span>
                                    <span>CNX {{ formatBigInt18Compact(record.staking) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
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

.more-link
    color rgba(0, 0, 0, 0.45)

.more-link:hover
    color rgba(0, 0, 0, 0.65)
    text-decoration underline

.more-link-icon
    font-size 10px

.total-power-card
    display flex
    flex-direction column

:deep(.total-power-card > .ant-card-body)
    flex 1 1 auto
    display flex
    flex-direction column

::v-deep(.total-power-card > .ant-card-body)
    flex 1 1 auto
    display flex
    flex-direction column

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
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(1)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(2)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(4)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(1)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(2)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(4)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

/* horizontal inner separator between two rows */
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)

::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)

/* responsive: fix inner borders when grid wraps to 2 columns on xs */
@media (max-width: 575.98px)
    /* reset to avoid conflicting borders after width change */
    ::deep(.nodes-tasks-card .ant-card-body > .ant-card-grid)
        border-right none
        border-top none
    ::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid)
        border-right none
        border-top none

    /* add right separator for left-column items: 1,3,5 */
    ::deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(odd))
        border-right 1px solid var(--ant-border-color-split, #f0f0f0)
    ::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(odd))
        border-right 1px solid var(--ant-border-color-split, #f0f0f0)

    /* add top separator starting from second row: 3..6 */
    ::deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(n+3))
        border-top 1px solid var(--ant-border-color-split, #f0f0f0)
    ::v-deep(.nodes-tasks-card .ant-card-body > .ant-card-grid:nth-child(n+3))
        border-top 1px solid var(--ant-border-color-split, #f0f0f0)

/* dynamic layout-aware separators */
/* 3-column layout */
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(1)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(2)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(4)),
::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(1)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(2)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(4)),
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(5))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

::deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)
::v-deep(.nodes-tasks-card.cols-3 .ant-card-body > .ant-card-grid:nth-child(n+4))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)

/* 2-column layout */
::deep(.nodes-tasks-card.cols-2 .ant-card-body > .ant-card-grid:nth-child(odd))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)
::v-deep(.nodes-tasks-card.cols-2 .ant-card-body > .ant-card-grid:nth-child(odd))
    border-right 1px solid var(--ant-border-color-split, #f0f0f0)

::deep(.nodes-tasks-card.cols-2 .ant-card-body > .ant-card-grid:nth-child(n+3))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)
::v-deep(.nodes-tasks-card.cols-2 .ant-card-body > .ant-card-grid:nth-child(n+3))
    border-top 1px solid var(--ant-border-color-split, #f0f0f0)

.compact-node-list
    display grid
    grid-template-columns repeat(3, minmax(0, 1fr))
    gap 8px

.compact-node-item
    min-width 0
    border 1px solid rgba(0, 0, 0, 0.08)
    border-radius 6px
    background rgba(255, 255, 255, 0.72)

.compact-node-item:hover
    border-color rgba(0, 0, 0, 0.18)

.compact-node-link
    display block
    padding 9px 10px
    color inherit
    text-decoration none

.compact-node-link:hover
    color inherit
    text-decoration none

.compact-node-title
    display flex
    align-items center
    gap 6px
    min-width 0

.compact-node-card
    flex 1 1 auto
    min-width 0
    font-size 12px
    font-weight 600
    color rgba(0, 0, 0, 0.72)
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.compact-node-tag
    flex none
    margin 0
    font-size 10px
    line-height 17px
    color rgba(0, 0, 0, 0.48)
    background rgba(0, 0, 0, 0.025)
    border-color rgba(0, 0, 0, 0.08)

.compact-node-meta
    display flex
    align-items center
    justify-content space-between
    gap 8px
    margin-top 7px
    font-size 11px
    color rgba(0, 0, 0, 0.42)
    white-space nowrap

@media (max-width: 991.98px)
    .compact-node-list
        grid-template-columns repeat(2, minmax(0, 1fr))

@media (max-width: 575.98px)
    .compact-node-list
        grid-template-columns 1fr

    .compact-node-meta
        justify-content flex-start
</style>
