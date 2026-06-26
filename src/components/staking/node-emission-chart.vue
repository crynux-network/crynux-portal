<template>
  <div class="chart-container">
    <div class="loading" v-if="loading">
      <loading-outlined />
    </div>
    <Line :data="data" :options="options" />
  </div>
</template>

<script setup>
import { Line } from 'vue-chartjs'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { onMounted, ref, watch } from 'vue'
import moment from 'moment'
import { Chart as ChartJS, registerables } from 'chart.js'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import { toBigInt } from '@/services/token'

ChartJS.register(...registerables)

const props = defineProps({
  address: {
    type: String,
    required: true
  }
})

const loading = ref(true)
const data = ref({
  labels: [],
  datasets: []
})

const formatCompact = (value) => {
  const num = Number(value || 0)
  const abs = Math.abs(num)
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}

const formatBigIntValue = (value) => {
  const bn = toBigInt(value)
  const base = 10n ** 18n
  const integer = bn / base
  const remainder = bn % base
  const fracStr = remainder.toString().padStart(18, '0').slice(0, 2)
  return parseFloat(integer.toString() + '.' + fracStr)
}

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top'
    },
    tooltip: {
      callbacks: {
        label: (context) => 'Emission: CNX ' + formatCompact(context.parsed.y)
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => formatCompact(value)
      },
      title: {
        display: true,
        text: 'Emission (CNX)'
      }
    }
  }
}

const buildEmptyDatasets = () => {
  const labels = []
  const emptyValues = []
  for (let i = 23; i >= 0; i--) {
    const d = moment().startOf('week').subtract(i, 'weeks')
    labels.push(d.format('MMM DD'))
    emptyValues.push(0)
  }

  return {
    labels,
    datasets: [
      {
        label: 'Emission',
        backgroundColor: 'rgba(250, 140, 22, 0.25)',
        borderColor: 'rgba(250, 140, 22, 1)',
        data: emptyValues,
        tension: 0.25,
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

    const resp = await v2DelegatedStakingAPI.getNodeEmissionChart(props.address, 24)
    const timestamps = Array.isArray(resp?.timestamps) ? resp.timestamps : []
    const emissions = Array.isArray(resp?.node_emission_income) ? resp.node_emission_income : []

    data.value = {
      labels: timestamps.map(ts => moment.unix(ts).format('MMM DD')),
      datasets: [
        {
          label: 'Operator emission',
          backgroundColor: 'rgba(250, 140, 22, 0.25)',
          borderColor: 'rgba(250, 140, 22, 1)',
          data: emissions.map(formatBigIntValue),
          tension: 0.25,
          fill: true
        }
      ]
    }
  } catch (error) {
    console.error('Failed to fetch node emission chart:', error)
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
