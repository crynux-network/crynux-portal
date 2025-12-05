<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { List as AList, Row as ARow, Col as ACol, Tag as ATag, Card as ACard, Tooltip as ATooltip, message } from 'ant-design-vue'
import { PlayCircleOutlined, PauseCircleOutlined, MinusCircleOutlined, FunnelPlotOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons-vue'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'
import { formatBigInt18Compact } from '@/services/token'
import NetworkTag from '@/components/network-tag.vue'

const nodes = ref([])
const loading = ref(false)
const nodesTotal = ref(0)
const nodesPage = ref(1)
const nodesPageSize = 30

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const handleResize = () => {
  windowWidth.value = window.innerWidth
}
const scoreSize = computed(() => {
  const w = windowWidth.value
  if (w >= 1600) return 88
  if (w >= 1200) return 80
  if (w >= 992) return 72
  if (w >= 768) return 64
  if (w >= 576) return 56
  return 48
})

const wallet = useWalletStore()
const networkName = computed(() => {
  const key = wallet.selectedNetworkKey
  return (config.networks[key] && config.networks[key].chainName) || key
})

const normalizeStatus = (status) => {
  const v = status
  if (typeof v === 'number') {
    if (v === 0) return 'stopped'         // Quit
    if (v === 5) return 'paused'          // Paused
    return 'running'                      // Available, Busy, Pending*
  }
  const s = String(v || '').toLowerCase()
  if (['quit', 'stopped', 'stop'].includes(s)) return 'stopped'
  if (['paused', 'pause'].includes(s)) return 'paused'
  if (['available', 'busy', 'running', 'idle', 'pendingpause', 'pendingquit', 'pending'].includes(s)) return 'running'
  return 'running'
}

const statusText = (status) => {
  const s = normalizeStatus(status)
  if (s === 'paused') return 'Paused'
  if (s === 'stopped') return 'Stopped'
  return 'Running'
}



const formatVram = (vram) => {
  const n = Number(vram)
  if (!Number.isFinite(n) || n <= 0) return '0 GB'
  return Math.round(n) + ' GB'
}

const formatIntegerWithThousands = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const intVal = Math.floor(Math.max(0, n))
  return intVal.toLocaleString('en-US')
}

const clampPercent = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

const percentFromRatio = (ratio) => {
  const r = Number.isFinite(Number(ratio)) ? Number(ratio) : 0
  return clampPercent(r * 100)
}



const fetchData = async (page = 1) => {
  loading.value = true
  try {
    const delegated = await v2DelegatedStakingAPI.getDelegatedNodes(page, nodesPageSize)
    nodes.value = (delegated && delegated.nodes) ? delegated.nodes : []
    nodesTotal.value = delegated?.total || 0
    nodesPage.value = page
  } catch (e) {
    message.error('Failed to load nodes: ' + e.message)
    console.error(e)
  } finally {
    loading.value = false
  }
}

const onNodesPageChange = (page) => {
  fetchData(page)
}

onMounted(() => {
  fetchData()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<template>
  <div class="stakeable-nodes-container">
    <a-card :title="'Stakeable Nodes'" :bordered="false" style="opacity: 0.9">
      <a-list
        :data-source="nodes"
        :loading="loading"
        :pagination="{
          current: nodesPage,
          pageSize: nodesPageSize,
          total: nodesTotal,
          onChange: onNodesPageChange
        }"
        row-key="address"
        :split="false"
        :grid="{ gutter: 8, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 3 }"
        style="width: 100%;"
      >
        <template #renderItem="{ item }">
          <a-list-item class="node-item">
            <div
              class="node-item-box"
              role="button"
              tabindex="0"
              @click="$router.push({ name: 'node-details', params: { address: item.address } })"
              @keydown.enter="$router.push({ name: 'node-details', params: { address: item.address } })"
            >
              <div class="basic-info">
                <div class="info-title">
                  <a-tooltip placement="left">
                    <template #title>{{ statusText(item.status) }}</template>
                    <div class="status-icon">
                      <play-circle-outlined v-if="normalizeStatus(item.status) === 'running'" />
                      <pause-circle-outlined v-else-if="normalizeStatus(item.status) === 'paused'" />
                      <minus-circle-outlined v-else />
                    </div>
                  </a-tooltip>
                  <div class="title-text">
                    <div class="card-line">
                      <span>{{ (item.gpu_name || '').split('+')[0] }}</span>
                    </div>
                    <div class="address-line">{{ item.address }}</div>
                  </div>
                </div>
                <div class="info-right">
                  <NetworkTag :text="networkName" />
                  <a-tag v-if="String(item.gpu_name || '').includes('+docker')" color="blue">Docker</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Windows')" color="green">Windows</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Darwin')" color="purple">Mac</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Linux')" color="orange">Linux</a-tag>
                  <a-tag color="cyan">{{ formatVram(item.gpu_vram) }}</a-tag>
                </div>
              </div>
              <a-row :gutter="[16, 16]" align="stretch" class="node-main">
                <a-col :xs="24" :md="24" class="earnings-row">
                  <div class="earnings-inline-compact">
                    <div class="earnings-inline-label">Delegators Earned Today</div>
                    <div class="earnings-inline-value">{{ formatBigInt18Compact(item.today_delegator_earnings) }}</div>
                  </div>
                </a-col>
                <a-col :xs="24" :md="24" class="left-pane">
                  <div class="scores-section">
                    <a-row :gutter="[16, 16]" class="scores-grid" align="middle">
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.prob_weight)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <funnel-plot-outlined />
                            <a-typography-text type="secondary">Prob Weight</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.qos_score)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <thunderbolt-outlined />
                            <a-typography-text type="secondary">QoS Score</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.staking_score)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <dollar-outlined />
                            <a-typography-text type="secondary">Staking Score</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                    </a-row>
                  </div>
                  <div class="delegators-section">
                    <a-row :gutter="[4, 4]" class="staking-grid">
                      <a-col :xs="7" :sm="7" :md="7" :lg="6" :xl="6" :xxl="6">
                        <div class="kpi">
                          <div class="kpi-value">{{ Math.round(Number(item.delegator_share || 0)) }} %</div>
                          <div class="kpi-label">Delegator Share</div>
                        </div>
                      </a-col>
                      <a-col :xs="10" :sm="10" :md="10" :lg="12" :xl="12" :xxl="12">
                        <div class="kpi">
                          <a-tooltip placement="top" :title="'Delegators / Node'">
                            <div class="kpi-value">
                              {{ formatBigInt18Compact(item.delegator_staking) }} / {{ formatBigInt18Compact(item.operator_staking) }}
                            </div>
                          </a-tooltip>
                          <div class="kpi-label">CNX Staked</div>
                        </div>
                      </a-col>
                      <a-col :xs="7" :sm="7" :md="7" :lg="6" :xl="6" :xxl="6">
                        <div class="kpi">
                          <div class="kpi-value">{{ formatIntegerWithThousands(item.delegators_num) }}</div>
                          <div class="kpi-label">Delegators</div>
                        </div>
                      </a-col>
                    </a-row>
                  </div>
                </a-col>
              </a-row>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
  </template>

<style scoped>
.stakeable-nodes-container {
  padding: 0;
  margin-top: 20px;
}
/* Ensure list grid spacing is truly reduced and left edge aligns with card title */
.stakeable-nodes-container :deep(.ant-list .ant-row) {
  margin-left: -4px;   /* -gutter/2 */
  margin-right: -4px;  /* -gutter/2 */
}
.stakeable-nodes-container :deep(.ant-list .ant-col) {
  padding-left: 4px;   /* gutter/2 */
  padding-right: 4px;  /* gutter/2 */
}
/* Ant List grid may render without Row/Col; fallback to adjust item paddings directly */
.stakeable-nodes-container :deep(.ant-list .ant-list-items) {
  margin-left: -4px;   /* -gutter/2 */
  margin-right: -4px;  /* -gutter/2 */
}
.stakeable-nodes-container :deep(.ant-list .ant-list-item) {
  padding-left: 4px;   /* gutter/2 */
  padding-right: 4px;  /* gutter/2 */
}
.node-item {
  padding: 0;
  margin-bottom: 36px;
  width: 100%;
}
.node-item:last-child {
  margin-bottom: 0;
}
.node-item-box {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 16px;
  background: #ffffff;
  width: 100%;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.node-item-box:hover {
  border-color: #1890ff;
}
.basic-info {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 10px 16px;
  margin: -16px -16px 12px;
  border-radius: 12px 12px 0 0;
  background: rgba(24, 144, 255, 0.06);
  flex-wrap: wrap;
}
.status-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 8px;
  color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  background: #fafafa;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.basic-info .info-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.basic-info .info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.basic-info .title-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.basic-info .card-line {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.basic-info .address-line {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.basic-info .info-right {
  margin-left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
}
/* Reduce default Tag spacing inside header */
.basic-info .info-right :deep(.ant-tag) {
  margin-right: 0;
  margin-left: 0;
}
.node-main {
  margin-top: 8px;
}
.earnings-row {
  width: 100%;
}
.earnings-inline {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 8px 12px;
}
.earnings-inline-compact {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.earnings-inline-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.earnings-inline-value {
  font-size: 18px;
  font-weight: 800;
  color: #1890ff;
  line-height: 1;
}
.earnings-inline :deep(.ant-descriptions-item-label) {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}
.earnings-value {
  font-size: 18px;
  font-weight: 800;
  color: #1890ff;
}
.staking-grid .ant-col:not(:first-child) .kpi {
  border-left: 1px solid rgba(0, 0, 0, 0.06);
}
.left-pane {
  border-right: 0;
  padding-right: 0;
}
.delegators-section {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 6px;
  margin-top: 20px;
  width: 100%;
  margin-left: 0;
  margin-right: 0;
}
.scores-section {
  background: transparent;
  border-radius: 0;
  padding: 0;
  margin-top: 0;
}
.score {
  text-align: center;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score :deep(.ant-progress-text) {
  color: #8c8c8c;
}
.score-label {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.score-label-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
  flex-wrap: nowrap;
  overflow: hidden;
}
.score-tag {
  font-size: 12px;
}
.score-label-row .anticon {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
}
.score-label-row .anticon svg {
  display: block;
}
.score-label-row :deep(.ant-typography) {
  font-size: 12px;
  line-height: 1;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score-label-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.score-number {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.65);
}
.kpi {
  text-align: center;
  padding: 6px 0;
}
.kpi-value {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
.kpi-label {
  margin-top: 6px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 768px) {
  .basic-info {
    flex-direction: column;
  }
  .status-icon {
    width: 30px;
    height: 30px;
    font-size: 18px;
    margin-right: 6px;
  }
  .basic-info .info-right {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
    padding-left: 0;
  }
  .status-icon {
    width: 28px;
    font-size: 24px;
    margin-right: 6px;
  }
  .left-pane {
    border-right: 0;
    padding-right: 0;
  }
  .delegators-section {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
  .earnings-pane {
    display: none !important;
  }
  /* Make the card full-bleed on mobile while avoiding horizontal scrollbars */
  .stakeable-nodes-container {
    margin-top: 0;
    padding: 0;
    overflow-x: hidden;
    margin-left: -16px;   /* counter parent horizontal padding */
    margin-right: -16px;  /* counter parent horizontal padding */
    width: calc(100% + 32px);
    box-sizing: border-box;
  }
  .stakeable-nodes-container :deep(.ant-card) {
    border-radius: 8px; /* keep rounded corners */
    border: 0;
    margin: 0;
  }
  .stakeable-nodes-container :deep(.ant-card-head) {
    padding: 0 12px;
    border-bottom: 0;
  }
  .stakeable-nodes-container :deep(.ant-card-body) {
    padding: 0; /* remove body padding; item gutters will provide spacing */
  }
  /* Prevent nested vertical scrollbars by letting content grow */
  .stakeable-nodes-container :deep(.ant-card),
  .stakeable-nodes-container :deep(.ant-card-body) {
    height: auto !important;
    overflow: hidden !important; /* avoid inner scrollbars */
  }
  .stakeable-nodes-container :deep(.ant-list) {
    height: auto !important;
    overflow: visible !important;
  }
  /* Remove list/grid side paddings to gain more width */
  .stakeable-nodes-container :deep(.ant-list .ant-row),
  .stakeable-nodes-container :deep(.ant-list .ant-list-items) {
    margin-left: 0;
    margin-right: 0;
  }
  .stakeable-nodes-container :deep(.ant-list .ant-col),
  .stakeable-nodes-container :deep(.ant-list .ant-list-item) {
    padding-left: 12px;  /* slightly larger side gutters per item */
    padding-right: 12px; /* slightly larger side gutters per item */
  }
  /* Add space between pager and card bottom on mobile */
  .stakeable-nodes-container :deep(.ant-list .ant-list-pagination),
  .stakeable-nodes-container :deep(.ant-list .ant-pagination) {
    margin-bottom: 12px;
  }
  /* Slightly increase vertical spacing between items on mobile */
  .node-item { margin-bottom: 44px; }
}
/* Responsive typography scaling */
@media (max-width: 1200px) {
  .kpi-value { font-size: 16px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 36px; }
  .earnings-value { font-size: 16px; }
  .score :deep(.ant-progress-text) { font-size: 14px; }
}
@media (max-width: 992px) {
  .kpi-value { font-size: 15px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 32px; }
  .earnings-value { font-size: 15px; }
  .score :deep(.ant-progress-text) { font-size: 13px; }
}
@media (max-width: 768px) {
  .kpi-value { font-size: 14px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 28px; }
  .earnings-value { font-size: 14px; }
  .score :deep(.ant-progress-text) { font-size: 12px; }
}
@media (max-width: 576px) {
  .kpi-value { font-size: 13px; }
  .kpi-label { font-size: 8px; }
  .earnings-big-value { font-size: 24px; }
  .earnings-value { font-size: 13px; }
  .score :deep(.ant-progress-text) { font-size: 12px; }
}
</style>
