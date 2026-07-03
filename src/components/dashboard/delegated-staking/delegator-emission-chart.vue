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
import v2RelayAccountAPI from '@/api/v2/relay-account'
import { walletAPI } from '@/api/v1/wallet'
import { toBigInt } from '@/services/token'

ChartJS.register(...registerables)

const WEEK_SECONDS = 7 * 24 * 60 * 60

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

const formatEstimatedEmissionValue = (value) => {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

const createCompletedFill = (context, color) => {
  const { chart, dataset } = context
  const { chartArea, ctx, scales } = chart
  const values = Array.isArray(dataset.data) ? dataset.data : []
  if (!chartArea || !scales?.x || values.length < 2 || dataset.estimatedStartIndex === undefined) return color

  const cutoffPixel = scales.x.getPixelForValue(dataset.estimatedStartIndex - 1)
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

const estimatedBorderDash = (context) => {
  const dataset = context.chart.data.datasets[context.datasetIndex]
  const estimatedStartIndex = dataset?.estimatedStartIndex
  return estimatedStartIndex !== undefined && context.p1DataIndex >= estimatedStartIndex ? [6, 6] : undefined
}

const fetchDelegationEmissionEstimate = async (address) => {
  try {
    const stats = await walletAPI.getDelegatorStats(address)
    return {
      timestamp: stats?.emission_week_end,
      value: stats?.estimated_upcoming_delegation_emission
    }
  } catch (error) {
    console.error('Failed to fetch delegator emission estimate:', error)
    return null
  }
}

const getEstimatedTimestamp = (timestamps, estimate) => {
  if (estimate?.timestamp) return estimate.timestamp
  if (timestamps.length > 0) return timestamps[timestamps.length - 1] + WEEK_SECONDS
  return moment().startOf('week').add(1, 'week').unix()
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
          const estimatedStartIndex = context.dataset.estimatedStartIndex
          const label = estimatedStartIndex !== undefined && context.dataIndex >= estimatedStartIndex
            ? 'Estimated emission'
            : 'Emission'
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
        label: 'Staking emission',
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

    const [resp, delegationEmissionEstimate] = await Promise.all([
      v2RelayAccountAPI.getEmissionChart(props.address, 24),
      fetchDelegationEmissionEstimate(props.address)
    ])
    const timestamps = Array.isArray(resp?.timestamps) ? resp.timestamps : []
    const delegationEmissions = Array.isArray(resp?.delegation_emission_income) ? resp.delegation_emission_income : []
    const labels = timestamps.map(ts => moment.unix(ts).format('MMM DD'))
    const values = delegationEmissions.map(formatBigIntValue)
    const estimatedTimestamp = getEstimatedTimestamp(timestamps, delegationEmissionEstimate)
    labels.push(moment.unix(estimatedTimestamp).format('MMM DD'))
    values.push(formatEstimatedEmissionValue(delegationEmissionEstimate?.value))
    const estimatedStartIndex = values.length - 1

    data.value = {
      labels,
      datasets: [
        {
          label: 'Staking emission',
          backgroundColor: (context) => createCompletedFill(context, 'rgba(250, 140, 22, 0.25)'),
          borderColor: 'rgba(250, 140, 22, 1)',
          data: values,
          tension: 0.25,
          fill: true,
          estimatedStartIndex,
          segment: {
            borderDash: estimatedBorderDash
          }
        }
      ]
    }
  } catch (e) {
    console.error('Failed to fetch delegator emission chart:', e)
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
