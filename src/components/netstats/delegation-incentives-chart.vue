<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import v2IncentivesAPI from '@/api/v2/incentives'
import { formatBigInt18, formatBigInt18Compact } from '@/services/token'
import {
  formatNetworkName,
  getAddressExplorerUrl,
  getDefaultSystemNetworkKey
} from '@/services/network-config'

const router = useRouter()
const loading = ref(true)
const delegationList = ref([])

const shortenAddress = (address) => {
  const value = String(address || '')
  if (value.length <= 10) return value
  return `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
}

const getExplorerUrl = (record, address) =>
  getAddressExplorerUrl(record.network || getDefaultSystemNetworkKey(), address)

const formatAprPercent = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const percent = Math.floor(Math.max(0, n) * 100)
  return `${percent.toLocaleString('en-US')}%`
}

const formatRank = (index) => String(index + 1).padStart(2, '0')

const getNodeDetailsUrl = (address) =>
  router.resolve({ name: 'node-details', params: { address } }).href

const formatNodeDisplayName = (record) => {
  const gpuName = String(record.gpu_name || '').split('+')[0].trim()
  return gpuName || shortenAddress(record.node_address)
}

const rowKey = (record) =>
  `${record.delegator_address}-${record.node_address}-${record.network}`

const fetchData = async () => {
  loading.value = true
  try {
    const resp = await v2IncentivesAPI.getTopDelegations()
    delegationList.value = resp.delegations || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchData()
})
</script>

<template>
  <a-spin :spinning="loading">
    <a-empty v-if="!loading && delegationList.length === 0" />
    <div v-else class="delegation-grid">
      <div
        v-for="(item, index) in delegationList"
        :key="rowKey(item)"
        class="delegation-item"
      >
        <div class="rank" :class="{ 'rank-top': index < 3 }">{{ formatRank(index) }}</div>
        <div class="identity">
          <div class="delegator-line">
            <a
              v-if="getExplorerUrl(item, item.delegator_address)"
              class="delegator-address explorer-link"
              :href="getExplorerUrl(item, item.delegator_address)"
              target="_blank"
              rel="noopener noreferrer"
            >{{ shortenAddress(item.delegator_address) }}</a>
            <span v-else class="delegator-address">{{ shortenAddress(item.delegator_address) }}</span>
            <a-tag class="plain-tag">{{ formatNetworkName(item.network) }}</a-tag>
          </div>
          <div class="node-meta">
            <div class="node-row">
              <span class="node-label">Node</span>
              <a
                class="node-address explorer-link"
                :href="getNodeDetailsUrl(item.node_address)"
                target="_blank"
                rel="noopener noreferrer"
              >{{ formatNodeDisplayName(item) }}</a>
            </div>
            <div class="node-row node-apr-row">
              <span class="node-label">Hist. APR</span>
              <span class="node-apr-value">{{ formatAprPercent(item.delegation_apr_12m) }}</span>
            </div>
          </div>
        </div>
        <div class="metrics">
          <div class="metric metric-secondary">
            <div class="metric-value">{{ formatBigInt18Compact(item.staking_amount) }}</div>
            <div class="metric-label">Staking</div>
          </div>
          <div class="metric metric-primary">
            <div class="metric-value fee-value">
              {{ formatBigInt18(item.task_fee, 4) }}<span class="fee-unit">CNX</span>
            </div>
            <div class="metric-label">Task Fee</div>
          </div>
        </div>
      </div>
    </div>
  </a-spin>
</template>

<style scoped>
.delegation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 991px) {
  .delegation-grid {
    grid-template-columns: 1fr;
  }
}
.delegation-item {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  background: #ffffff;
  min-width: 0;
  transition: border-color 0.2s ease;
}
.delegation-item:hover {
  border-color: rgba(0, 0, 0, 0.4);
}
.rank {
  flex: none;
  width: 28px;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(0, 0, 0, 0.25);
  text-align: center;
}
.rank-top {
  color: #4096ff;
}
.identity {
  flex: 1 1 auto;
  min-width: 0;
}
.delegator-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: 2px;
}
.delegator-address {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.plain-tag {
  flex: none;
  margin: 0;
  font-size: 11px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.55);
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.1);
}
.node-meta {
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.node-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
}
.node-apr-row {
  margin-top: 2px;
}
.node-label {
  flex: none;
  width: 48px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.38);
}
.node-address {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.62);
  overflow: hidden;
  text-overflow: ellipsis;
}
.node-apr-value {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.62);
  font-variant-numeric: tabular-nums;
}
.metrics {
  flex: none;
  display: flex;
  align-items: center;
  gap: 20px;
  text-align: right;
}
.metric {
  min-width: 0;
}
.metric-value {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.metric-label {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
  white-space: nowrap;
}
.metric-primary .metric-value.fee-value {
  font-size: 17px;
  font-weight: 600;
  color: #4096ff;
  line-height: 1.2;
}
.fee-unit {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}
@media (max-width: 575px) {
  .delegation-item {
    gap: 10px;
  }
  .metrics {
    gap: 12px;
  }
  .metric-secondary {
    display: none;
  }
}
.explorer-link {
  text-decoration: none;
}
.explorer-link:hover {
  text-decoration: underline;
}
</style>
