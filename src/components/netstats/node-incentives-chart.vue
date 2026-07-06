<script setup>
import v2IncentivesAPI from "@/api/v2/incentives";
import {onMounted, reactive, ref, watch} from "vue";
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
import { formatBigInt18Compact } from '@/services/token'
import { getAddressExplorerUrl, getDefaultSystemNetworkKey } from '@/services/network-config'



const loading = ref(true);
const periodOptions = reactive(['Day', "Week", "Month"]);
const periodSelected = ref(periodOptions[0]);

const nodeList = ref([]);

const formatCnxValue = (value) => Number(value).toFixed(4);
const getNodeAddressUrl = (address) => getAddressExplorerUrl(getDefaultSystemNetworkKey(), address)

const columns = [
    {
        title: 'Address',
        dataIndex: 'node_address',
        key: 'node_address'
    },
    {
        title: 'Card',
        dataIndex: 'card_model',
        key: 'card_model'
    },
    {
        title: 'Task Count',
        dataIndex: 'task_count',
        key: 'task_count'
    },
    {
        title: 'Staking Score',
        dataIndex: 'staking_score',
        key: 'staking_score'
    },
    {
        title: 'QoS Score',
        dataIndex: 'qos_score',
        key: 'qos_score'
    },
    {
        title: 'Prob Weight',
        dataIndex: 'prob_weight',
        key: 'prob_weight'
    },
    {
        title: 'Stake',
        dataIndex: 'staking',
        key: 'staking'
    },
    {
        title: 'Task Fee',
        dataIndex: 'incentive',
        key: 'incentive'
    }
];

watch([periodSelected], async () => {
    await fetchData()
});

onMounted(async () => {
    await fetchData()
});

const fetchData = async () => {
    loading.value = true;
    try {
         const resp = await v2IncentivesAPI.getNodes(periodSelected.value);
         nodeList.value = resp.nodes;
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <a-alert
        type="info"
        show-icon
        style="margin-bottom: 16px"
    >
        <template #description>
            The values for card, staking, and scores are real-time and change dynamically, so they may differ from what they were when the task fees were earned.
        </template>
    </a-alert>
    <div style="height:40px">
        <div style="float: left">
            <a-segmented v-model:value="periodSelected" :options="periodOptions" size="small"/>
        </div>
    </div>
    <a-table
        :data-source="nodeList"
        :columns="columns"
        :loading="loading"
        :pagination="{
            'pageSize': 10
        }"
        :scroll="{ x: 800 }"
        size="small"
    >
        <template #headerCell="{ column }">
            <template v-if="column.key === 'staking'">
                <span class="stake-title">
                    Stake
                    <a-tooltip title="Stake is the sum of Delegated Stake, Operator Stake, and Locked Emission.">
                        <question-circle-outlined class="stake-title-icon" />
                    </a-tooltip>
                </span>
            </template>
            <template v-else>
                {{ column.title }}
            </template>
        </template>
        <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'node_address'">
                    <a v-if="getNodeAddressUrl(record.node_address)" class="explorer-link" :href="getNodeAddressUrl(record.node_address)" target="_blank" rel="noopener noreferrer">{{ record.node_address.substring(0, 5) }}...{{ record.node_address.substring(record.node_address.length - 5, record.node_address.length) }}</a>
                    <span v-else>{{ record.node_address.substring(0, 5) }}...{{ record.node_address.substring(record.node_address.length - 5, record.node_address.length) }}</span>
            </template>
            <template v-else-if="column.key === 'incentive'">
                    CNX {{ formatCnxValue(record.incentive) }}
            </template>
            <template v-else-if="column.key === 'card_model'">
                <div style="display: flex; align-items: center">
                    <span>{{ record.card_model.split('+')[0] }}</span>
                    <a-tag v-if="record.vram" color="cyan" style="margin-left: 4px;">{{ record.vram }}GB</a-tag>
                    <a-tag v-if="record.card_model.includes('+docker')" color="blue">Docker</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Windows')" color="green">Windows</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Darwin')" color="purple">Mac</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Linux')" color="orange">Linux</a-tag>
                </div>
            </template>
            <template v-else-if="column.key === 'staking'">
                CNX {{ formatBigInt18Compact(record.staking) }}
            </template>
            <template v-else-if="column.key === 'staking_score'">
                {{ (record.staking_score * 100).toFixed(2) }}%
            </template>
            <template v-else-if="column.key === 'qos_score'">
                {{ (record.qos_score * 100).toFixed(2) }}%
            </template>
            <template v-else-if="column.key === 'prob_weight'">
                {{ (record.prob_weight * 2 * 100).toFixed(2) }}%
            </template>
        </template>
    </a-table>
</template>

<style scoped>
.stake-title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.stake-title-icon {
    color: rgba(0, 0, 0, 0.45);
    cursor: help;
}

.explorer-link {
    color: inherit;
    text-decoration: none;
}

.explorer-link:hover {
    color: inherit;
    text-decoration: underline;
}
</style>
