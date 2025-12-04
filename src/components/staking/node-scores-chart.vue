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
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            max: 100,
            title: {
                display: true,
                text: 'Score (%)'
            }
        }
    }
};

const fetchData = async () => {
    if (!props.address) return;

    loading.value = true;
    try {
        const resp = await statsAPI.getNodeScores(props.address);

        data.value = {
            labels: resp.timestamps.map((item) => {
                const date = moment.unix(item);
                return date.format("MMM DD");
            }),
            datasets: [
                {
                    label: 'Prob Weight',
                    backgroundColor: 'rgba(24, 144, 255, 0.5)',
                    borderColor: 'rgba(24, 144, 255, 1)',
                    data: resp.prob_weights.map(v => v * 100),
                    tension: 0.1
                },
                {
                    label: 'QoS Score',
                    backgroundColor: 'rgba(82, 196, 26, 0.5)',
                    borderColor: 'rgba(82, 196, 26, 1)',
                    data: resp.qos_scores.map(v => v * 100),
                    tension: 0.1
                },
                {
                    label: 'Staking Score',
                    backgroundColor: 'rgba(250, 173, 20, 0.5)',
                    borderColor: 'rgba(250, 173, 20, 1)',
                    data: resp.staking_scores.map(v => v * 100),
                    tension: 0.1
                }
            ]
        };
    } catch (error) {
        console.error("Error fetching node scores: ", error);
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
