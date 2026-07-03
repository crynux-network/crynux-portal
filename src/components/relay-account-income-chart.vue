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

const formatCnxValue = (value) => {
    return Number(value || 0).toFixed(4);
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
    const fracStr = remainder.toString().padStart(18, '0').slice(0, 4);
    return parseFloat(integer.toString() + '.' + fracStr);
};

const createCompletedFill = (context, color) => {
    const { chart, dataset } = context;
    const { chartArea, ctx, scales } = chart;
    const values = Array.isArray(dataset.data) ? dataset.data : [];
    if (!chartArea || !scales?.x || values.length < 2 || dataset.incompleteStartIndex === undefined) return color;

    const cutoffPixel = scales.x.getPixelForValue(dataset.incompleteStartIndex - 1);
    const chartWidth = chartArea.right - chartArea.left;
    if (!Number.isFinite(cutoffPixel) || !Number.isFinite(chartWidth) || chartWidth <= 0) return color;

    const cutoff = (cutoffPixel - chartArea.left) / chartWidth;
    const stop = Math.min(1, Math.max(0, cutoff));
    if (!Number.isFinite(stop)) return color;

    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(stop, color);
    gradient.addColorStop(stop, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    return gradient;
};

const incompleteBorderDash = (context) => {
    const dataset = context.chart.data.datasets[context.datasetIndex];
    const incompleteStartIndex = dataset?.incompleteStartIndex;
    return incompleteStartIndex !== undefined && context.p1DataIndex >= incompleteStartIndex ? [6, 6] : undefined;
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
                    return context.dataset.label + ': CNX ' + formatCnxValue(context.parsed.y);
                },
                footer: (tooltipItems) => {
                    let sum = 0;
                    tooltipItems.forEach(item => {
                        sum += item.parsed.y;
                    });
                    return 'Total: CNX ' + formatCnxValue(sum);
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
            ticks: {
                callback: (value) => formatCnxValue(value)
            },
            title: {
                display: true,
                text: 'Task Fee'
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
                    backgroundColor: (context) => createCompletedFill(context, 'rgba(82, 196, 26, 0.6)'),
                    borderColor: 'rgba(82, 196, 26, 1)',
                    data: nodeValues,
                    tension: 0.1,
                    fill: true,
                    incompleteStartIndex: nodeValues.length - 1,
                    segment: {
                        borderDash: incompleteBorderDash
                    }
                },
                {
                    label: 'Delegated Staking',
                    backgroundColor: (context) => createCompletedFill(context, 'rgba(24, 144, 255, 0.6)'),
                    borderColor: 'rgba(24, 144, 255, 1)',
                    data: stakingValues,
                    tension: 0.1,
                    fill: true,
                    incompleteStartIndex: stakingValues.length - 1,
                    segment: {
                        borderDash: incompleteBorderDash
                    }
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
