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
import { walletAPI } from '@/api/v1/wallet'
import moment from 'moment'
import { Chart as ChartJS, registerables } from 'chart.js'
import { toBigInt } from '@/services/token'

ChartJS.register(...registerables)

const props = defineProps({
  delegatorAddress: {
    type: String,
    required: true
  },
  nodeAddress: {
    type: String,
    required: true
  },
  network: {
    type: String,
    required: true
  },
  height: {
    type: Number,
    default: 220
  }
})

const loading = ref(true)

const data = ref({
  labels: [],
  datasets: []
})

const formatCnxValue = (value) => {
  const num = Number(value || 0)
  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(2) + 'K'
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
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          return 'Task Fee: CNX ' + formatCnxValue(context.parsed.y)
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => formatCnxValue(value)
      },
      title: {
        display: true,
        text: 'Task Fee (CNX)'
      }
    }
  }
}

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
        label: 'Task Fee',
        backgroundColor: 'rgba(82, 196, 26, 0.4)',
        borderColor: 'rgba(82, 196, 26, 1)',
        data: [...emptyValues],
        tension: 0.3,
        fill: true
      }
    ]
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    if (!props.delegatorAddress || !props.nodeAddress || !props.network) {
      data.value = buildEmptyDatasets()
      return
    }

    const resp = await walletAPI.getDelegationIncomeChart(props.delegatorAddress, props.nodeAddress, props.network)

    const timestamps = Array.isArray(resp?.timestamps) ? resp.timestamps : []
    const earningsArr = Array.isArray(resp?.earnings) ? resp.earnings : []

    const labels = timestamps.map(ts => moment.unix(ts).format('DD MMM'))
    const values = earningsArr.map(formatBigIntValue)

    data.value = {
      labels,
      datasets: [
        {
          label: 'Task Fee',
          backgroundColor: 'rgba(82, 196, 26, 0.4)',
          borderColor: 'rgba(82, 196, 26, 1)',
          data: values,
          tension: 0.3,
          fill: true
        }
      ]
    }
  } catch (e) {
    console.error('Failed to fetch delegation income:', e)
    data.value = buildEmptyDatasets()
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.delegatorAddress, props.nodeAddress, props.network],
  async () => {
    await fetchData()
  }
)

onMounted(async () => {
  await fetchData()
})
</script>

<style scoped>
.chart-container {
  position: relative;
  height: v-bind('height + "px"');
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
