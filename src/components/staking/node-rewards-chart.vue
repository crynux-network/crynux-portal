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
    height: 280px;
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
import statsAPI from "@/api/v1/stats";
import moment from "moment";
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const props = defineProps({
    address: {
        type: String,
        required: true
    }
});

const loading = ref(true);

const data = ref({
    labels: [],
    datasets: []
});

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
            ticks: {
                callback: (value) => Number(value || 0).toFixed(4)
            },
            title: {
                display: true,
                text: 'Task Fee (CNX)'
            }
        }
    }
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

const formatCompact = (value) => {
    const num = Number(value || 0);
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
};

const fetchData = async () => {
    if (!props.address) return;

    loading.value = true;
    try {
        const resp = await statsAPI.getNodeEarnings(props.address);

        data.value = {
            labels: resp.timestamps.map((item) => {
                const date = moment.unix(item);
                return date.format("MMM DD");
            }),
            datasets: [
                {
                    label: 'Operator Task Fee',
                    backgroundColor: 'rgba(82, 196, 26, 0.6)',
                    borderColor: 'rgba(82, 196, 26, 1)',
                    data: resp.operator_earnings.map(formatBigIntValue),
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Delegator Task Fee',
                    backgroundColor: 'rgba(24, 144, 255, 0.6)',
                    borderColor: 'rgba(24, 144, 255, 1)',
                    data: resp.delegator_earnings.map(formatBigIntValue),
                    tension: 0.1,
                    fill: true
                }
            ]
        };
    } catch (error) {
        console.error("Error fetching node rewards: ", error);
    } finally {
        loading.value = false;
    }
};

watch(() => props.address, async () => {
    await fetchData();
});

onMounted(async () => {
    await fetchData();
});
</script>
