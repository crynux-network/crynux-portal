<template>
    <div class="chart-container">
        <div class="loading" v-if="loading">
            <loading-outlined />
        </div>
        <Line :data="data" :options="options" />
    </div>
</template>
<style scoped>
.chart-container {
    position: relative;
    height: 260px;
}
.loading {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    height: 100%;
    text-align: center;
    font-size: 40px;
    background-color: white;
    opacity: 0.3;
    box-sizing: border-box;
    padding-top: 60px;
}
</style>
<script setup>
import { Line } from 'vue-chartjs'
import { LoadingOutlined } from "@ant-design/icons-vue";
import { onMounted, ref, watch } from "vue";
import { walletAPI } from "@/api/v1/wallet";
import moment from "moment";
import { Chart as ChartJS, registerables } from 'chart.js'

ChartJS.register(...registerables)

const props = defineProps({
    address: {
        type: String,
        default: ''
    }
})

const loading = ref(true);

const data = ref({
    labels: [],
    datasets: []
});

const formatCompact = (value) => {
    const num = Math.abs(value);
    const toOneDecimal = (val, unit) => {
        const scaled = Math.floor(val * 10 / unit);
        const whole = Math.floor(scaled / 10);
        const frac = scaled % 10;
        return frac === 0 ? `${whole}` : `${whole}.${frac}`;
    };
    if (num >= 1e9) return toOneDecimal(num, 1e9) + 'B';
    if (num >= 1e6) return toOneDecimal(num, 1e6) + 'M';
    if (num >= 1e3) return toOneDecimal(num, 1e3) + 'K';
    return Math.floor(num).toString();
};

const formatBigIntValue = (value) => {
    let bn = 0n;
    try {
        if (typeof value === 'bigint') bn = value;
        else if (typeof value === 'string') bn = BigInt(value);
        else if (typeof value === 'number') bn = BigInt(Math.floor(Math.max(0, value)));
    } catch { bn = 0n; }
    const base = 10n ** 18n;
    const integer = bn / base;
    const remainder = bn % base;
    const fracStr = remainder.toString().padStart(18, '0').slice(0, 2);
    return parseFloat(integer.toString() + '.' + fracStr);
};

const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: true,
            position: 'top'
        },
        tooltip: {
            mode: 'index',
            itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
            callbacks: {
                label: (context) => {
                    return context.dataset.label + ': CNX ' + formatCompact(context.parsed.y);
                },
                footer: (tooltipItems) => {
                    let sum = 0;
                    tooltipItems.forEach(item => {
                        sum += item.parsed.y;
                    });
                    return 'Total: CNX ' + formatCompact(sum);
                }
            }
        }
    },
    scales: {
        x: {
            stacked: true
        },
        y: {
            stacked: true,
            beginAtZero: true,
            title: {
                display: true,
                text: 'Income (CNX)'
            }
        }
    }
};

const buildEmptyDatasets = () => {
    const labels = []
    const emptyValues = []
    for (let i = 29; i >= 0; i--) {
        const d = moment().startOf('day').subtract(i, 'days')
        labels.push(d.format('DD MMM'))
        emptyValues.push(0)
    }
    return {
        labels,
        datasets: [
            {
                label: 'Node',
                backgroundColor: 'rgba(82, 196, 26, 0.6)',
                borderColor: 'rgba(82, 196, 26, 1)',
                data: [...emptyValues],
                tension: 0.1,
                fill: true
            },
            {
                label: 'Delegated Staking',
                backgroundColor: 'rgba(24, 144, 255, 0.6)',
                borderColor: 'rgba(24, 144, 255, 1)',
                data: [...emptyValues],
                tension: 0.1,
                fill: true
            }
        ]
    }
}

const fetchData = async () => {
    loading.value = true
    try {
        if (!props.address) {
            data.value = buildEmptyDatasets()
            return
        }

        const resp = await walletAPI.getIncomeStats(props.address)

        const timestamps = Array.isArray(resp?.timestamps) ? resp.timestamps : []
        const nodeIncomeArr = Array.isArray(resp?.node_income) ? resp.node_income : []
        const stakingIncomeArr = Array.isArray(resp?.delegated_staking_income) ? resp.delegated_staking_income : []

        const labels = timestamps.map(ts => moment.unix(ts).format('DD MMM'))
        const nodeValues = nodeIncomeArr.map(formatBigIntValue)
        const stakingValues = stakingIncomeArr.map(formatBigIntValue)

        data.value = {
            labels,
            datasets: [
                {
                    label: 'Node',
                    backgroundColor: 'rgba(82, 196, 26, 0.6)',
                    borderColor: 'rgba(82, 196, 26, 1)',
                    data: nodeValues,
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Delegated Staking',
                    backgroundColor: 'rgba(24, 144, 255, 0.6)',
                    borderColor: 'rgba(24, 144, 255, 1)',
                    data: stakingValues,
                    tension: 0.1,
                    fill: true
                }
            ]
        }
    } catch (e) {
        console.error('Failed to fetch income stats:', e)
        data.value = buildEmptyDatasets()
    } finally {
        loading.value = false
    }
}

watch(() => props.address, async () => {
    await fetchData()
})

onMounted(async () => {
    await fetchData()
})
</script>
