<template>
    <div class="loading" v-if="loading">
        <loading-outlined />
    </div>
    <div class="chart-container">
        <Line :data="data" :options="options" />
    </div>
</template>
<style scoped>
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
    padding-top: 120px;
}
.chart-container {
    height: 260px;
}
</style>
<script setup>
import { Line } from 'vue-chartjs'
import { LoadingOutlined } from "@ant-design/icons-vue";
import { onMounted, ref, watch } from "vue";
import incentivesAPI from "@/api/v1/incentives";
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
    datasets: [
        {
            label: 'Earnings',
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            data: []
        }
    ]
});

const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        y: {
            beginAtZero: true,
            title: {
                display: true,
                text: 'Earnings (CNX)'
            }
        }
    }
};

const buildEmptySeries = () => {
    const labels = []
    const values = []
    for (let i = 29; i >= 0; i--) {
        const d = moment().startOf('day').subtract(i, 'days')
        labels.push(d.format('DD MMM'))
        values.push(0)
    }
    return { labels, values }
}

const fetchData = async () => {
    loading.value = true
    try {
        if (!props.address) {
            const empty = buildEmptySeries()
            data.value = {
                labels: empty.labels,
                datasets: [
                    {
                        label: 'Earnings',
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        data: empty.values
                    }
                ]
            }
            return
        }

        const resp = await incentivesAPI.getNodeIncentives(props.address, 1, 30)
        const arr = Array.isArray(resp) ? resp : []

        const map = new Map()
        for (const item of arr) {
            const ts = Number(item && (item.timestamp || item.time))
            const amt = Number(item && (item.amount || item.value || 0))
            if (!isFinite(ts)) continue
            const dayKey = moment.unix(ts).startOf('day').format('YYYY-MM-DD')
            const prev = map.get(dayKey) || 0
            map.set(dayKey, prev + (isFinite(amt) ? amt : 0))
        }

        const labels = []
        const values = []
        for (let i = 29; i >= 0; i--) {
            const d = moment().startOf('day').subtract(i, 'days')
            const key = d.format('YYYY-MM-DD')
            labels.push(d.format('DD MMM'))
            values.push(Number(map.get(key) || 0))
        }

        data.value = {
            labels,
            datasets: [
                {
                    label: 'Earnings',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    data: values
                }
            ]
        }
    } catch (e) {
        const empty = buildEmptySeries()
        data.value = {
            labels: empty.labels,
            datasets: [
                {
                    label: 'Earnings',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    data: empty.values
                }
            ]
        }
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
