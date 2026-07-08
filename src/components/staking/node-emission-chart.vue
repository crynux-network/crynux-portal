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

const WEEK_SECONDS = 7 * 24 * 60 * 60

const props = defineProps({
  address: {
    type: String,
    required: true
  },
  estimatedOperatorEmission: {
    type: [String, Number, BigInt],
    default: null
  },
  estimatedDelegatorEmission: {
    type: [String, Number, BigInt],
    default: null
  },
  estimatedEmissionTimestamp: {
    type: Number,
    default: 0
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

  const cutoff = chartWidth > 0 ? (cutoffPixel - chartArea.left) / chartWidth : 1
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
  const estimatedStartIndex = dataset.estimatedStartIndex
  return estimatedStartIndex !== undefined && context.p1DataIndex >= estimatedStartIndex ? [6, 6] : undefined
}

const getTooltipLabel = (context) => {
  const estimatedStartIndex = context.dataset.estimatedStartIndex
  const label = estimatedStartIndex !== undefined && context.dataIndex >= estimatedStartIndex
    ? context.dataset.estimatedLabel
    : context.dataset.label
  return `${label}: CNX ${formatCompact(context.parsed.y)}`
}

const getEstimatedTimestamp = (timestamps) => {
  if (props.estimatedEmissionTimestamp) return props.estimatedEmissionTimestamp
  if (timestamps.length > 0) return timestamps[timestamps.length - 1] + WEEK_SECONDS
  return moment().startOf('week').add(1, 'week').unix()
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
        label: getTooltipLabel
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      stacked: true,
      ticks: {
        callback: (value) => formatCompact(value)
      },
      title: {
        display: true,
        text: 'Emission (CNX)'
      }
    },
    x: {
      stacked: true
    }
  },
  interaction: {
    mode: 'index',
    intersect: false
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
        label: 'Operator emission',
        backgroundColor: 'rgba(250, 140, 22, 0.25)',
        borderColor: 'rgba(250, 140, 22, 1)',
        data: emptyValues,
        tension: 0.25,
        fill: true,
        stack: 'emission'
      },
      {
        label: 'Delegators emission',
        backgroundColor: 'rgba(24, 144, 255, 0.25)',
        borderColor: 'rgba(24, 144, 255, 1)',
        data: emptyValues,
        tension: 0.25,
        fill: true,
        stack: 'emission'
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
    const operatorEmissions = Array.isArray(resp?.node_emission_income) ? resp.node_emission_income : []
    const delegationEmissions = Array.isArray(resp?.delegation_emission_income) ? resp.delegation_emission_income : []
    const labels = timestamps.map(ts => moment.unix(ts).format('MMM DD'))
    const operatorValues = operatorEmissions.map(formatBigIntValue)
    const delegationValues = delegationEmissions.map(formatBigIntValue)
    const estimatedTimestamp = getEstimatedTimestamp(timestamps)
    labels.push(moment.unix(estimatedTimestamp).format('MMM DD'))
    operatorValues.push(formatEstimatedEmissionValue(props.estimatedOperatorEmission))
    delegationValues.push(formatEstimatedEmissionValue(props.estimatedDelegatorEmission))
    const estimatedStartIndex = labels.length - 1

    data.value = {
      labels,
      datasets: [
        {
          label: 'Operator emission',
          backgroundColor: (context) => createCompletedFill(context, 'rgba(250, 140, 22, 0.25)'),
          borderColor: 'rgba(250, 140, 22, 1)',
          data: operatorValues,
          tension: 0.25,
          fill: true,
          stack: 'emission',
          estimatedStartIndex,
          estimatedLabel: 'Estimated operator emission',
          segment: {
            borderDash: estimatedBorderDash
          }
        },
        {
          label: 'Delegators emission',
          backgroundColor: (context) => createCompletedFill(context, 'rgba(24, 144, 255, 0.25)'),
          borderColor: 'rgba(24, 144, 255, 1)',
          data: delegationValues,
          tension: 0.25,
          fill: true,
          stack: 'emission',
          estimatedStartIndex,
          estimatedLabel: 'Estimated delegators emission',
          segment: {
            borderDash: estimatedBorderDash
          }
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

watch(
  () => [props.address, props.estimatedOperatorEmission, props.estimatedDelegatorEmission, props.estimatedEmissionTimestamp],
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
