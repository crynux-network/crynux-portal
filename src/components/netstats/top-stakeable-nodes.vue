<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import { formatBigInt18Compact } from '@/services/token'
import { formatNetworkName } from '@/services/network-config'

const router = useRouter()
const nodes = ref([])
const loading = ref(true)

const formatGpuName = (name) => String(name || '').split('+')[0]

const formatVram = (vram) => {
  const n = Number(vram)
  if (!Number.isFinite(n) || n <= 0) return '0 GB'
  return Math.round(n) + ' GB'
}

const formatWholeCnxAmount = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const amount = Math.floor(Math.max(0, n))
  const toOneDecimal = (val, unit) => {
    const scaled = Math.floor((val * 10) / unit)
    const whole = Math.floor(scaled / 10)
    const frac = scaled % 10
    return frac === 0 ? `${whole}` : `${whole}.${frac}`
  }
  if (amount >= 1_000_000_000) return `${toOneDecimal(amount, 1_000_000_000)}B`
  if (amount >= 1_000_000) return `${toOneDecimal(amount, 1_000_000)}M`
  if (amount >= 1_000) return `${toOneDecimal(amount, 1_000)}K`
  return amount.toLocaleString('en-US')
}

const formatAprPercent = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const percent = Math.floor(Math.max(0, n) * 100)
  return `${percent.toLocaleString('en-US')}%`
}

const openNodeDetails = (address) => {
  const href = router.resolve({ name: 'node-details', params: { address } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

const fetchData = async () => {
  loading.value = true
  try {
    const delegated = await v2DelegatedStakingAPI.getDelegatedNodes({
      page: 1,
      pageSize: 8,
      sortBy: 'delegation_apr_12m'
    })
    nodes.value = (delegated && delegated.nodes) ? delegated.nodes : []
  } catch (e) {
    message.error('Failed to load top stakeable nodes: ' + e.message)
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <a-spin :spinning="loading">
    <a-empty v-if="!loading && nodes.length === 0" />
    <div v-else class="node-grid">
      <div
        v-for="item in nodes"
        :key="item.address"
        class="node-card"
        role="button"
        tabindex="0"
        @click="openNodeDetails(item.address)"
        @keydown.enter="openNodeDetails(item.address)"
      >
        <div class="gpu-name">{{ formatGpuName(item.gpu_name) }}</div>
        <div class="tags-line">
          <a-tag class="plain-tag">{{ formatNetworkName(item.network) }}</a-tag>
          <a-tag class="plain-tag">{{ formatVram(item.gpu_vram) }}</a-tag>
        </div>
        <div class="apr-value">{{ formatAprPercent(item.delegation_apr_12m) }}</div>
        <div class="apr-label">Historical APR</div>
        <div class="metrics-line">
          <div class="metric">
            <div class="metric-value">{{ formatWholeCnxAmount(item.estimated_upcoming_delegator_emission) }}</div>
            <div class="metric-label">Next Emission</div>
          </div>
          <div class="metric">
            <div class="metric-value">{{ formatAprPercent(item.estimated_next_10k_delegation_apr) }}</div>
            <div class="metric-label">Next 10K APR</div>
          </div>
          <div class="metric">
            <div class="metric-value">{{ formatBigInt18Compact(item.delegator_staking) }}</div>
            <div class="metric-label">Delegated</div>
          </div>
        </div>
      </div>
    </div>
  </a-spin>
</template>

<style scoped>
.node-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 991px) {
  .node-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 575px) {
  .node-grid {
    grid-template-columns: 1fr;
  }
}
.node-card {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 16px;
  background: #ffffff;
  min-width: 0;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s ease;
}
.node-card:hover {
  border-color: rgba(0, 0, 0, 0.4);
}
.gpu-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tags-line {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 6px;
}
.plain-tag {
  margin: 0;
  color: rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.1);
}
.apr-value {
  font-size: 24px;
  font-weight: 500;
  color: #4096ff;
  line-height: 1.2;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.apr-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
}
.metrics-line {
  display: flex;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.metric {
  flex: 1;
  min-width: 0;
}
.metric-value {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.metric-label {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
