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

const DAY_SECONDS = 24 * 60 * 60

const props = defineProps({
  address: {
    type: String,
    default: ''
  },
  height: {
    type: Number,
    default: 260
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
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(4) + 'B'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(4) + 'M'
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(4) + 'K'
  return num.toFixed(4)
}

const formatBigIntValue = (value) => {
  const bn = toBigInt(value)
  const base = 10n ** 18n
  const integer = bn / base
  const remainder = bn % base
  const fracStr = remainder.toString().padStart(18, '0').slice(0, 4)
  return parseFloat(integer.toString() + '.' + fracStr)
}

const createCompletedFill = (context, color) => {
  const { chart, dataset } = context
  const { chartArea, ctx, scales } = chart
  const values = Array.isArray(dataset.data) ? dataset.data : []
  if (!chartArea || !scales?.x || values.length < 2 || dataset.currentStartIndex === undefined) return color

  const cutoffPixel = scales.x.getPixelForValue(dataset.currentStartIndex - 1)
  const chartWidth = chartArea.right - chartArea.left
  if (!Number.isFinite(cutoffPixel) || !Number.isFinite(chartWidth) || chartWidth <= 0) return color

  const cutoff = (cutoffPixel - chartArea.left) / chartWidth
  const stop = Math.min(1, Math.max(0, cutoff))
  if (!Number.isFinite(stop)) return color

  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
  gradient.addColorStop(0, color)
  gradient.addColorStop(stop, color)
  gradient.addColorStop(stop, 'rgba(0, 0, 0, 0)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  return gradient
}

const currentBorderDash = (context) => {
  const dataset = context.chart.data.datasets[context.datasetIndex]
  const currentStartIndex = dataset?.currentStartIndex
  return currentStartIndex !== undefined && context.p1DataIndex >= currentStartIndex ? [6, 6] : undefined
}

const getCurrentTaskFeePoint = (timestamps, earningsArr) => {
  const currentDayStart = moment.utc().startOf('day').unix()
  const index = timestamps.findIndex(ts => ts >= currentDayStart && ts < currentDayStart + DAY_SECONDS)
  return {
    timestamp: currentDayStart,
    value: index >= 0 ? earningsArr[index] : 0
  }
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
          const currentStartIndex = context.dataset.currentStartIndex
          const label = currentStartIndex !== undefined && context.dataIndex >= currentStartIndex
            ? 'Current task fee'
            : 'Task Fee'
          return label + ': CNX ' + formatCnxValue(context.parsed.y)
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
        backgroundColor: 'rgba(24, 144, 255, 0.4)',
        borderColor: 'rgba(24, 144, 255, 1)',
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
    if (!props.address) {
      data.value = buildEmptyDatasets()
      return
    }

    const resp = await walletAPI.getDelegatorEarningsChart(props.address)

    const timestamps = Array.isArray(resp?.timestamps) ? resp.timestamps : []
    const earningsArr = Array.isArray(resp?.earnings) ? resp.earnings : []

    const currentTaskFeePoint = getCurrentTaskFeePoint(timestamps, earningsArr)
    const historicalTimestamps = []
    const historicalValues = []
    timestamps.forEach((ts, index) => {
      if (ts < currentTaskFeePoint.timestamp) {
        historicalTimestamps.push(ts)
        historicalValues.push(earningsArr[index])
      }
    })
    const labels = historicalTimestamps.map(ts => moment.unix(ts).format('DD MMM'))
    const values = historicalValues.map(formatBigIntValue)
    labels.push(moment.unix(currentTaskFeePoint.timestamp).format('DD MMM'))
    values.push(formatBigIntValue(currentTaskFeePoint.value))
    const currentStartIndex = values.length - 1

    data.value = {
      labels,
      datasets: [
        {
          label: 'Task Fee',
          backgroundColor: (context) => createCompletedFill(context, 'rgba(24, 144, 255, 0.4)'),
          borderColor: 'rgba(24, 144, 255, 1)',
          data: values,
          tension: 0.3,
          fill: true,
          currentStartIndex,
          segment: {
            borderDash: currentBorderDash
          }
        }
      ]
    }
  } catch (e) {
    console.error('Failed to fetch delegator income:', e)
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
