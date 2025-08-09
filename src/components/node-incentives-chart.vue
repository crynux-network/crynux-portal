<script setup>
import v2IncentivesAPI from "@/api/v2/incentives";
import {onMounted, reactive, ref, watch} from "vue";

const props = defineProps({
    network: {
        type: String,
        required: true
    }
});

const loading = ref(true);
const periodOptions = reactive(['Day', "Week", "Month"]);
const periodSelected = ref(periodOptions[0]);

const nodeList = ref([]);

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
        title: 'Staking',
        dataIndex: 'staking',
        key: 'staking'
    },
    {
        title: 'Incentives',
        dataIndex: 'incentive',
        key: 'incentive'
    }
];

const toEtherValue = (bigNum) => {
    if (!bigNum || bigNum === "0") return 0

    const bn = BigInt(bigNum)

    const decimals = (bn / BigInt(1e18)).toString()
    let fractions = ((bn / BigInt(1e16)) % 100n).toString()
    if (fractions.length === 1) fractions += '0'

    return decimals + '.' + fractions
}

watch([periodSelected, () => props.network], async () => {
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
            The values for card, staking, and scores are real-time and change dynamically, so they may differ from what they were when the incentives were earned.
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
            'pageSize': 5
        }"
        size="small"
    >
        <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'node_address'">
                    {{ record.node_address.substring(0, 5) }}...{{ record.node_address.substring(record.node_address.length - 5, record.node_address.length) }}
            </template>
            <template v-else-if="column.key === 'incentive'">
                    CNX {{ record.incentive.toFixed(2) }}
            </template>
            <template v-else-if="column.key === 'card_model'">
                <div style="display: flex; align-items: center">
                    <span>{{ record.card_model.split('+')[0] }}</span>
                    <a-tag v-if="record.card_model.includes('+docker')" color="blue" style="margin-left: 8px;">Docker</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Windows')" color="green" style="margin-left: 8px;">Windows</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Darwin')" color="purple" style="margin-left: 8px;">Mac</a-tag>
                    <a-tag v-else-if="record.card_model.includes('+Linux')" color="orange" style="margin-left: 8px;">Linux</a-tag>
                </div>
            </template>
            <template v-else-if="column.key === 'staking'">
                CNX {{ toEtherValue(record.staking) }}
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
</style>
