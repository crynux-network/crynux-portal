<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
import v2IncentivesAPI from '@/api/v2/incentives'
import { formatBigInt18Compact } from '@/services/token'

const router = useRouter()
const loading = ref(true)
const nodeList = ref([])

const formatCnxValue = (value) => Number(value || 0).toFixed(4)

const shortenAddress = (address) => {
  const value = String(address || '')
  if (value.length <= 10) return value
  return `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
}

const getNodeDetailsUrl = (address) =>
  router.resolve({ name: 'node-details', params: { address } }).href

const formatCardName = (cardModel) => String(cardModel || '').split('+')[0] || 'Unknown Card'

const getPlatformTag = (cardModel) => {
  const value = String(cardModel || '')
  if (value.includes('+docker')) return 'Docker'
  if (value.includes('+Windows')) return 'Windows'
  if (value.includes('+Darwin')) return 'Mac'
  if (value.includes('+Linux')) return 'Linux'
  return ''
}

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`

const formatProbWeight = (value) => `${(Number(value || 0) * 2 * 100).toFixed(2)}%`

const formatCount = (value) => Number(value || 0).toLocaleString('en-US')

onMounted(async () => {
  await fetchData()
})

const fetchData = async () => {
  loading.value = true
  try {
    const resp = await v2IncentivesAPI.getNodes()
    nodeList.value = resp.nodes || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <a-alert
    type="info"
    show-icon
    style="margin-bottom: 16px"
  >
    <template #description>
      The values for card, staking, and scores are real-time and change dynamically, so they may differ from what they were when the task fees were earned.
    </template>
  </a-alert>
  <a-spin :spinning="loading">
    <a-empty v-if="!loading && nodeList.length === 0" />
    <div v-else class="node-fee-grid">
      <div
        v-for="(item, index) in nodeList"
        :key="item.node_address"
        class="node-fee-item"
      >
        <div class="rank" :class="{ 'rank-top': index < 3 }">{{ String(index + 1).padStart(2, '0') }}</div>
        <div class="identity">
          <div class="card-line">
            <a
              class="card-name explorer-link"
              :href="getNodeDetailsUrl(item.node_address)"
              target="_blank"
              rel="noopener noreferrer"
            >{{ formatCardName(item.card_model) }}</a>
            <a-tag v-if="item.vram" class="plain-tag">{{ item.vram }}GB</a-tag>
            <a-tag v-if="getPlatformTag(item.card_model)" class="plain-tag">{{ getPlatformTag(item.card_model) }}</a-tag>
          </div>
          <div class="node-address">{{ item.node_address }}</div>
          <div class="task-summary">
            <span class="task-total">{{ formatCount(item.task_count) }}</span>
            <span class="task-label">Tasks</span>
          </div>
        </div>
        <div class="bottom-row">
          <div class="score-group">
            <div class="metric score-chip score-chip-qos">
              <div class="metric-value">{{ formatPercent(item.qos_score) }}</div>
              <div class="metric-label">QoS</div>
            </div>
            <div class="metric score-chip score-chip-stake">
              <div class="metric-value">{{ formatPercent(item.staking_score) }}</div>
              <div class="metric-label">Stake Score</div>
            </div>
            <div class="metric score-chip score-chip-prob">
              <div class="metric-value">{{ formatProbWeight(item.prob_weight) }}</div>
              <div class="metric-label">Prob Weight</div>
            </div>
          </div>
          <div class="metrics">
            <div class="metric metric-secondary">
              <div class="metric-value">
                {{ formatBigInt18Compact(item.staking) }}
                <a-tooltip title="Effective Stake = Operator Stake + Delegated Stake + Locked Emission * 0.4 + Relay Account Balance.">
                  <question-circle-outlined class="stake-title-icon" />
                </a-tooltip>
              </div>
              <div class="metric-label">Effective Stake</div>
            </div>
            <div class="metric metric-primary">
              <div class="metric-value fee-value">
                {{ formatCnxValue(item.incentive) }}<span class="fee-unit">CNX</span>
              </div>
              <div class="metric-label">Task Fee</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </a-spin>
</template>

<style scoped>
.node-fee-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 991px) {
  .node-fee-grid {
    grid-template-columns: 1fr;
  }
}
.node-fee-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  column-gap: 14px;
  row-gap: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  background: #ffffff;
  min-width: 0;
  transition: border-color 0.2s ease;
}
.node-fee-item:hover {
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
  min-width: 0;
  position: relative;
  padding-right: 86px;
}
.card-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.card-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 78px;
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
.node-address {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  overflow-wrap: anywhere;
  line-height: 1.35;
}
.task-summary {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  text-align: right;
}
.task-total {
  font-size: 13px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.65);
  font-variant-numeric: tabular-nums;
}
.task-label {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.42);
}
.bottom-row {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
.score-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: left;
}
.score-chip {
  padding: 6px 9px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.025);
}
.score-chip-qos {
  background: #e6f4ff;
  border-color: #91caff;
}
.score-chip-stake {
  background: #f6ffed;
  border-color: #b7eb8f;
}
.score-chip-prob {
  background: #f9f0ff;
  border-color: #d3adf7;
}
.metrics {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: right;
}
.metric {
  min-width: 0;
}
.metric-value {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.metric-label {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
  white-space: nowrap;
}
.stake-title-icon {
  margin-left: 4px;
  color: rgba(0, 0, 0, 0.38);
  cursor: help;
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
@media (max-width: 1199px) {
  .node-fee-item {
    grid-template-columns: 28px minmax(0, 1fr);
  }
  .score-group {
    display: flex;
  }
}
@media (max-width: 575px) {
  .node-fee-item {
    gap: 10px;
  }
  .bottom-row {
    justify-content: flex-end;
  }
  .score-group {
    display: none;
  }
  .metrics {
    gap: 12px;
  }
  .metric-secondary {
    display: none;
  }
  .identity {
    padding-right: 0;
  }
  .task-summary {
    position: static;
    justify-content: flex-end;
    margin-top: 5px;
  }
}
.explorer-link {
  text-decoration: none;
}
.explorer-link:hover {
  text-decoration: underline;
}
</style>
