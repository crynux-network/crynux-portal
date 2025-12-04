<script setup>
import { useRoute } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Tag as ATag,
  Button as AButton,
  Tooltip as ATooltip,
  Progress as AProgress,
  Spin as ASpin,
  Divider as ADivider,
  TypographyText as ATypographyText,
  Table as ATable,
  Empty as AEmpty,
  message
} from 'ant-design-vue'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  MinusCircleOutlined,
  FunnelPlotOutlined,
  ThunderboltOutlined,
  DollarOutlined
} from '@ant-design/icons-vue'
import { ethers } from 'ethers'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import { walletAPI } from '@/api/v1/wallet'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import config from '@/config.json'
import NetworkTag from '@/components/network-tag.vue'
import NodeRewardsChart from '@/components/staking/node-rewards-chart.vue'
import NodeStakingChart from '@/components/staking/node-staking-chart.vue'
import NodeScoresChart from '@/components/staking/node-scores-chart.vue'
import NodeDelegatorsChart from '@/components/staking/node-delegators-chart.vue'

const route = useRoute()
const wallet = useWalletStore()
const auth = useAuthStore()

const nodeAddress = computed(() => route.params.address)
const node = ref(null)
const loading = ref(false)
const delegations = ref([])
const delegationsLoading = ref(false)
const delegationsTotal = ref(0)
const delegationsPage = ref(1)
const delegationsPageSize = 10

const networkName = computed(() => {
  const key = wallet.selectedNetworkKey
  return (config.networks[key] && config.networks[key].chainName) || key
})

// Mock staking data - will be replaced with actual data later
const userStaking = ref(null)
const hasStaking = computed(() => wallet.isConnected && userStaking.value !== null)

const normalizeStatus = (status) => {
  const v = status
  if (typeof v === 'number') {
    if (v === 0) return 'stopped'
    if (v === 5) return 'paused'
    return 'running'
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

const formatBigInt18 = (value, decimals = 2) => {
  let bn = 0n
  try {
    if (typeof value === 'bigint') bn = value
    else if (typeof value === 'string') bn = BigInt(value)
    else if (typeof value === 'number') bn = BigInt(Math.floor(Math.max(0, value)))
  } catch { bn = 0n }
  const base = 10n ** 18n
  const integer = bn / base
  const remainder = bn % base
  const fracStr = remainder.toString().padStart(18, '0').slice(0, decimals)
  if (decimals === 0) return formatIntegerWithThousands(integer.toString())
  return formatIntegerWithThousands(integer.toString()) + '.' + fracStr
}

const formatBigInt18Compact = (value) => {
  let bn = 0n
  try {
    if (typeof value === 'bigint') bn = value
    else if (typeof value === 'string') bn = BigInt(value)
    else if (typeof value === 'number') bn = BigInt(Math.floor(Math.max(0, value)))
  } catch { bn = 0n }
  const base = 10n ** 18n
  const integer = bn / base
  const B = 1_000_000_000n
  const M = 1_000_000n
  const K = 1_000n
  const toOneDecimal = (val, unit) => {
    const scaledTimes10 = (val * 10n) / unit
    const whole = scaledTimes10 / 10n
    const frac = scaledTimes10 % 10n
    return frac === 0n ? `${whole}` : `${whole}.${frac}`
  }
  if (integer >= B) return `${toOneDecimal(integer, B)}B`
  if (integer >= M) return `${toOneDecimal(integer, M)}M`
  if (integer >= K) return `${toOneDecimal(integer, K)}K`
  return formatIntegerWithThousands(integer.toString())
}

const gpuDisplayName = computed(() => {
  if (!node.value?.gpu_name) return ''
  return node.value.gpu_name.split('+')[0]
})

const osTag = computed(() => {
  const gpuName = String(node.value?.gpu_name || '')
  if (gpuName.includes('+docker')) return { label: 'Docker', color: 'blue' }
  if (gpuName.includes('+Windows')) return { label: 'Windows', color: 'green' }
  if (gpuName.includes('+Darwin')) return { label: 'Mac', color: 'purple' }
  if (gpuName.includes('+Linux')) return { label: 'Linux', color: 'orange' }
  return null
})

const totalStaking = computed(() => {
  if (!node.value) return 0n
  const op = typeof node.value.operator_staking === 'bigint' ? node.value.operator_staking : BigInt(node.value.operator_staking || 0)
  const del = typeof node.value.delegator_staking === 'bigint' ? node.value.delegator_staking : BigInt(node.value.delegator_staking || 0)
  return op + del
})

const fetchData = async () => {
  loading.value = true
  try {
    const data = await v2DelegatedStakingAPI.getNodeDetails(nodeAddress.value)
    node.value = data
  } catch (e) {
    message.error('Failed to load node details: ' + e.message)
    console.error(e)
  } finally {
    loading.value = false
  }
}

const fetchDelegations = async (page = 1) => {
  if (!node.value?.network) return
  delegationsLoading.value = true
  try {
    const resp = await v2DelegatedStakingAPI.getNodeDelegations(nodeAddress.value, node.value.network, page, delegationsPageSize)
    delegations.value = Array.isArray(resp?.delegations) ? resp.delegations : []
    delegationsTotal.value = resp?.total || 0
    delegationsPage.value = page
  } catch (e) {
    console.error('Failed to load delegations:', e)
    delegations.value = []
    delegationsTotal.value = 0
  } finally {
    delegationsLoading.value = false
  }
}

const onDelegationsPageChange = (page) => {
  fetchDelegations(page)
}

const delegationsColumns = [
  {
    title: 'Delegator',
    dataIndex: 'user_address',
    key: 'user_address',
    width: 150
  },
  {
    title: 'Staking',
    dataIndex: 'staking_amount',
    key: 'staking_amount',
    width: 100,
    align: 'right'
  },
  {
    title: 'Staked At',
    dataIndex: 'staked_at',
    key: 'staked_at',
    width: 110,
    align: 'center'
  },
  {
    title: 'Rewards Today',
    dataIndex: 'today_earnings',
    key: 'today_earnings',
    width: 120,
    align: 'right'
  },
  {
    title: 'Rewards Total',
    dataIndex: 'total_earnings',
    key: 'total_earnings',
    width: 120,
    align: 'right'
  }
]

const formatStakingAmount = (value) => {
  return formatBigInt18Compact(value)
}

const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const shortenAddress = (address) => {
  if (!address) return ''
  return address.slice(0, 8) + '...' + address.slice(-6)
}

const handleStake = () => {
  // Placeholder for stake action
  message.info('Stake functionality coming soon')
}

let isAuthenticating = false

async function refreshAccountAndBalance() {
  const provider = window.ethereum
  if (!provider) return
  const accounts = await provider.request({ method: 'eth_accounts' })
  let address = accounts && accounts.length ? accounts[0] : null
  if (address) {
    try {
      address = ethers.getAddress(address)
    } catch (e) {
      address = null
    }
  }
  wallet.setAccount(address)
  if (address) {
    let chainId = null
    try {
      chainId = await provider.request({ method: 'eth_chainId' })
    } catch (e) {
      chainId = null
    }
    wallet.setChainId(chainId)
    await wallet.fetchBalance()
  } else {
    wallet.setBalanceWei('0x0')
    auth.clearSession()
  }
}

function authenticate() {
  if (isAuthenticating) return Promise.resolve()
  const provider = window.ethereum
  if (!provider) {
    message.error('Please install MetaMask in your browser.')
    return Promise.reject(new Error('No provider'))
  }
  isAuthenticating = true
  const timestamp = Math.floor(Date.now() / 1000)
  const action = 'Connect Wallet'
  return provider.request({ method: 'eth_requestAccounts' })
    .then((accounts) => {
      const acct = (accounts && accounts.length) ? accounts[0] : null
      if (!acct) throw new Error('No account connected')
      const addressToAuth = ethers.getAddress(acct)
      const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${addressToAuth}\nTimestamp: ${timestamp}`
      return provider.request({
        method: 'personal_sign',
        params: [messageToSign, addressToAuth]
      }).then(signature => ({ signature, addressToAuth }))
    })
    .then(({ signature, addressToAuth }) => walletAPI.connectWallet({ address: addressToAuth, signature, timestamp })
      .then(resp => ({ resp, addressToAuth })))
    .then(({ resp, addressToAuth }) => {
      auth.setSession(resp.token, resp.expires_at, addressToAuth)
      wallet.setAccount(addressToAuth)
      return wallet.ensureNetworkOnWallet(wallet.selectedNetworkKey)
        .then(() => refreshAccountAndBalance())
        .then(() => {
          message.success('Wallet connected')
        })
    })
    .catch(async (e) => {
      console.error('Authentication error:', e)
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
      } catch (err) { console.error('Failed to revoke wallet permissions:', err) }
      wallet.setAccount(null)
      wallet.setBalanceWei('0x0')
      auth.clearSession()
      message.error('Authentication failed or was rejected')
    })
    .finally(() => {
      isAuthenticating = false
    })
}

async function connect() {
  return authenticate()
}

onMounted(async () => {
  await fetchData()
  fetchDelegations()
})
</script>

<template>
  <div class="node-details-container">
    <a-spin :spinning="loading" tip="Loading...">
      <a-row :gutter="[24, 24]" v-if="node">
        <!-- Left Card: Node Basic Info -->
        <a-col :xs="24" :lg="8">
          <a-card class="info-card" :bordered="false">
            <div class="node-header">
              <div class="status-badge">
                <a-tooltip :title="statusText(node.status)">
                  <div class="status-icon">
                    <play-circle-outlined v-if="normalizeStatus(node.status) === 'running'" />
                    <pause-circle-outlined v-else-if="normalizeStatus(node.status) === 'paused'" />
                    <minus-circle-outlined v-else />
                  </div>
                </a-tooltip>
              </div>
              <div class="node-title-section">
                <div class="gpu-name">{{ gpuDisplayName }}</div>
                <a-typography-text class="node-address" copyable :content="node.address">
                  {{ node.address }}
                </a-typography-text>
              </div>
            </div>

            <div class="tags-row">
              <NetworkTag :text="networkName" />
              <a-tag v-if="osTag" :color="osTag.color">{{ osTag.label }}</a-tag>
              <a-tag color="cyan">{{ formatVram(node.gpu_vram) }}</a-tag>
              <a-tag v-if="node.version">v{{ node.version }}</a-tag>
            </div>

            <div class="delegator-share-row">
              <span class="delegator-share-label">Delegator Share</span>
              <span class="delegator-share-value">{{ Math.round(Number(node.delegator_share || 0)) }}%</span>
            </div>

            <a-divider />

            <!-- User Staking Section -->
            <div class="user-staking-section">
              <template v-if="!wallet.isConnected">
                <div class="not-connected">
                  <p>Connect your wallet to stake on this node</p>
                  <a-button type="primary" @click="connect">Connect</a-button>
                </div>
              </template>

              <template v-else-if="hasStaking">
                <div class="staking-info">
                  <div class="staking-detail">
                    <span class="label">Staked Amount</span>
                    <span class="value">{{ formatBigInt18(userStaking.amount) }} CNX</span>
                  </div>
                  <div class="staking-detail">
                    <span class="label">Staked Since</span>
                    <span class="value">{{ userStaking.stakedAt }}</span>
                  </div>
                  <div class="staking-detail">
                    <span class="label">Today Earnings</span>
                    <span class="value earnings">{{ formatBigInt18(userStaking.todayEarnings) }} CNX</span>
                  </div>
                  <div class="staking-detail">
                    <span class="label">Total Earnings</span>
                    <span class="value earnings">{{ formatBigInt18(userStaking.totalEarnings) }} CNX</span>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="no-staking">
                  <p>You haven't staked on this node yet</p>
                  <a-button type="primary" @click="handleStake">
                    <template #icon><dollar-outlined /></template>
                    Stake Now
                  </a-button>
                </div>
              </template>
            </div>
          </a-card>
        </a-col>

        <!-- Right Card: Node Metrics -->
        <a-col :xs="24" :lg="16">
          <a-card class="metrics-card" :bordered="false">
            <a-row :gutter="[0, 0]" class="metrics-row">
              <!-- Left Section: Scores + Staking + Delegators -->
              <a-col :xs="24" :md="16" class="metrics-left">
                <!-- Score Stats (at the top, no title) -->
                <div class="metrics-section scores-section-top">
                  <a-row :gutter="[16, 16]" align="middle">
                    <a-col :xs="8">
                      <div class="score-box score-blue">
                        <a-progress
                          type="circle"
                          :percent="percentFromRatio(node.prob_weight)"
                          :size="72"
                          :stroke-color="'#1890ff'"
                          :trail-color="'#e9e9e9'"
                          :format="(p) => Math.round(p).toString()"
                        />
                        <div class="score-label">
                          <funnel-plot-outlined />
                          <span>Prob Weight</span>
                        </div>
                      </div>
                    </a-col>
                    <a-col :xs="8">
                      <div class="score-box score-green">
                        <a-progress
                          type="circle"
                          :percent="percentFromRatio(node.qos_score)"
                          :size="72"
                          :stroke-color="'#52c41a'"
                          :trail-color="'#e9e9e9'"
                          :format="(p) => Math.round(p).toString()"
                        />
                        <div class="score-label">
                          <thunderbolt-outlined />
                          <span>QoS Score</span>
                        </div>
                      </div>
                    </a-col>
                    <a-col :xs="8">
                      <div class="score-box score-orange">
                        <a-progress
                          type="circle"
                          :percent="percentFromRatio(node.staking_score)"
                          :size="72"
                          :stroke-color="'#faad14'"
                          :trail-color="'#e9e9e9'"
                          :format="(p) => Math.round(p).toString()"
                        />
                        <div class="score-label">
                          <dollar-outlined />
                          <span>Staking Score</span>
                        </div>
                      </div>
                    </a-col>
                  </a-row>
                </div>

                <!-- Staking Stats -->
                <div class="metrics-section">
                  <a-row :gutter="[16, 16]">
                    <a-col :xs="8">
                      <div class="metric-box">
                        <div class="metric-value">{{ formatBigInt18Compact(totalStaking) }}</div>
                        <div class="metric-label">Total Staked</div>
                      </div>
                    </a-col>
                    <a-col :xs="8">
                      <div class="metric-box">
                        <div class="metric-value">{{ formatBigInt18Compact(node.operator_staking) }}</div>
                        <div class="metric-label">Operator Staked</div>
                      </div>
                    </a-col>
                    <a-col :xs="8">
                      <div class="metric-box">
                        <div class="metric-value">{{ formatBigInt18Compact(node.delegator_staking) }}</div>
                        <div class="metric-label">Delegators Staked</div>
                      </div>
                    </a-col>
                  </a-row>
                </div>

                <!-- Operator Rewards (subtle display) -->
                <div class="operator-rewards-section">
                  <div class="operator-rewards-title">Operator Rewards</div>
                  <div class="operator-rewards-row">
                    <div class="operator-reward-item">
                      <span class="operator-reward-value">{{ formatBigInt18Compact(node.today_operator_earnings) }}</span>
                      <span class="operator-reward-label">Today</span>
                    </div>
                    <div class="operator-reward-divider"></div>
                    <div class="operator-reward-item">
                      <span class="operator-reward-value">{{ formatBigInt18Compact(node.total_operator_earnings) }}</span>
                      <span class="operator-reward-label">Total</span>
                    </div>
                  </div>
                </div>
              </a-col>

              <!-- Right Section: Delegators -->
              <a-col :xs="24" :md="8" class="metrics-right">
                <div class="delegator-rewards-section">
                  <div class="delegator-num-box">
                    <div class="delegator-num-value">{{ formatIntegerWithThousands(node.delegators_num) }}</div>
                    <div class="delegator-num-label">Active Delegators</div>
                  </div>

                  <div class="reward-highlight-box">
                    <div class="reward-highlight-value">{{ formatBigInt18Compact(node.today_delegator_earnings) }}</div>
                    <div class="reward-highlight-label">Delegators Rewards Today</div>
                  </div>

                  <div class="reward-highlight-box total">
                    <div class="reward-highlight-value">{{ formatBigInt18Compact(node.total_delegator_earnings) }}</div>
                    <div class="reward-highlight-label">Delegators Rewards Total</div>
                  </div>
                </div>
              </a-col>
            </a-row>
          </a-card>
        </a-col>
      </a-row>

      <!-- Node Rewards Chart -->
      <a-row :gutter="[24, 24]" style="margin-top: 24px" v-if="node">
        <a-col :span="24">
          <a-card class="chart-card" title="Node Rewards" :bordered="false">
            <NodeRewardsChart :address="nodeAddress" />
          </a-card>
        </a-col>
      </a-row>

      <!-- Node Charts Row 1 -->
      <a-row :gutter="[24, 24]" style="margin-top: 24px" v-if="node">
        <a-col :xs="24" :lg="12">
          <a-card class="chart-card" title="Node Scores" :bordered="false">
            <NodeScoresChart :address="nodeAddress" />
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="12">
          <a-card class="chart-card" title="Node Staking" :bordered="false">
            <NodeStakingChart :address="nodeAddress" />
          </a-card>
        </a-col>
      </a-row>

      <!-- Node Charts Row 2 -->
      <a-row :gutter="[24, 24]" style="margin-top: 24px" v-if="node">
        <a-col :xs="24" :lg="8">
          <a-card class="chart-card" title="Delegators" :bordered="false">
            <NodeDelegatorsChart :address="nodeAddress" />
          </a-card>
        </a-col>
        <a-col :xs="24" :lg="16">
          <a-card class="delegations-card" title="Delegations" :bordered="false">
            <a-spin :spinning="delegationsLoading">
              <a-table
                v-if="delegations.length > 0"
                :columns="delegationsColumns"
                :data-source="delegations"
                :pagination="{
                  current: delegationsPage,
                  pageSize: delegationsPageSize,
                  total: delegationsTotal,
                  size: 'small',
                  onChange: onDelegationsPageChange
                }"
                :scroll="{ x: 500 }"
                size="small"
                row-key="user_address"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'user_address'">
                    <a-tooltip :title="record.user_address">
                      <span class="delegator-address">{{ shortenAddress(record.user_address) }}</span>
                    </a-tooltip>
                  </template>
                  <template v-else-if="column.key === 'staking_amount'">
                    <span>{{ formatStakingAmount(record.staking_amount) }}</span>
                  </template>
                  <template v-else-if="column.key === 'staked_at'">
                    <span>{{ formatDate(record.staked_at) }}</span>
                  </template>
                  <template v-else-if="column.key === 'today_earnings'">
                    <span>{{ formatStakingAmount(record.today_earnings) }}</span>
                  </template>
                  <template v-else-if="column.key === 'total_earnings'">
                    <span>{{ formatStakingAmount(record.total_earnings) }}</span>
                  </template>
                </template>
              </a-table>
              <div v-else class="empty-delegations">
                  <a-empty description="No delegations yet" />
                </div>
            </a-spin>
          </a-card>
        </a-col>
      </a-row>

      <div v-else-if="!loading" class="no-data">
        <p>Node not found or failed to load</p>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.node-details-container {
  padding: 0;
  max-width: 1600px;
  margin: 0 auto;
  margin-top: 20px;
}

/* Info Card Styles */
.info-card {
  background: #ffffff;
  border-radius: 12px;
  height: 100%;
}

.info-card :deep(.ant-card-body) {
  padding: 24px;
}

.node-header {
  display: flex;
  align-items: stretch;
  gap: 16px;
  margin-bottom: 16px;
}

.status-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.status-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #fafafa;
}

.node-title-section {
  flex: 1;
  min-width: 0;
}

.gpu-name {
  font-size: 20px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.85);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-address {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  word-break: break-all;
}

.node-address :deep(.ant-typography-copy) {
  color: rgba(0, 0, 0, 0.45);
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}

.tags-row :deep(.ant-tag) {
  margin-right: 0;
}

/* Delegator Share Row */
.delegator-share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(24, 144, 255, 0.06);
  border-radius: 8px;
  margin-top: 12px;
}

.delegator-share-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.delegator-share-value {
  font-size: 18px;
  font-weight: 700;
  color: #1890ff;
}

/* User Staking Section */
.user-staking-section {
  margin-top: 0;
}

.not-connected,
.no-staking {
  text-align: center;
  padding: 40px 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.not-connected p,
.no-staking p {
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 16px;
}

.staking-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(24, 144, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(24, 144, 255, 0.1);
}

.staking-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.staking-detail .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.staking-detail .value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.staking-detail .value.earnings {
  color: #52c41a;
}

/* Metrics Card Styles */
.metrics-card {
  background: #ffffff;
  border-radius: 12px;
  height: 100%;
}

.metrics-card :deep(.ant-card-body) {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.metrics-row {
  height: 100%;
  flex: 1;
}

.metrics-left {
  padding-right: 24px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 24px;
}

.metrics-right {
  border-left: 1px solid rgba(0, 0, 0, 0.06);
  padding-left: 24px;
}

.metrics-section {
  margin-bottom: 0;
}

.metrics-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.section-header .anticon {
  font-size: 16px;
  color: rgba(0, 0, 0, 0.45);
}

.section-header.highlight {
  color: #1890ff;
}

.section-header.highlight .anticon {
  color: #1890ff;
}

/* Delegator Num Box */
.delegator-num-box {
  text-align: center;
  padding: 20px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.delegator-num-value {
  font-size: 32px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1;
}

.delegator-num-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 6px;
}

/* Metric Boxes */
.metric-box {
  text-align: center;
  padding: 12px 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.2;
}

.metric-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 4px;
}

/* Score Boxes */
.scores-section-top {
  margin-bottom: 28px;
}

.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.score-box.score-blue :deep(.ant-progress-text) {
  color: #1890ff;
}

.score-box.score-green :deep(.ant-progress-text) {
  color: #52c41a;
}

.score-box.score-orange :deep(.ant-progress-text) {
  color: #faad14;
}

.score-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.score-label .anticon {
  font-size: 12px;
}

/* Reward Boxes */
.reward-box {
  text-align: center;
  padding: 16px 8px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.reward-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.2;
}

.reward-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 4px;
}

/* Operator Rewards Section (subtle) */
.operator-rewards-section {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.operator-rewards-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  margin-bottom: 8px;
}

.operator-rewards-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.operator-reward-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.operator-reward-value {
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}

.operator-reward-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
}

.operator-reward-divider {
  width: 1px;
  height: 16px;
  background: rgba(0, 0, 0, 0.1);
}

/* Delegator Rewards Section (Right Column) */
.delegator-rewards-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.reward-highlight-box {
  text-align: center;
  padding: 20px 12px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.08) 0%, rgba(24, 144, 255, 0.02) 100%);
  border-radius: 12px;
  border: 1px solid rgba(24, 144, 255, 0.1);
}

.reward-highlight-box.total {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.08) 0%, rgba(82, 196, 26, 0.02) 100%);
  border-color: rgba(82, 196, 26, 0.1);
}

.reward-highlight-value {
  font-size: 32px;
  font-weight: 800;
  color: #1890ff;
  line-height: 1;
}

.reward-highlight-box.total .reward-highlight-value {
  color: #52c41a;
}

.reward-highlight-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 6px;
}

/* Chart Card Styles */
.chart-card {
  background: #ffffff;
  border-radius: 12px;
  height: 100%;
}

.chart-card :deep(.ant-card-body) {
  padding: 24px;
  position: relative;
}

/* Delegations Card Styles */
.delegations-card {
  background: #ffffff;
  border-radius: 12px;
  height: 100%;
}

.delegations-card :deep(.ant-card-body) {
  padding: 24px;
}

.delegator-address {
  font-family: monospace;
  font-size: 13px;
}


.empty-delegations {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

/* No Data State */
.no-data {
  text-align: center;
  padding: 60px 24px;
  background: #ffffff;
  border-radius: 12px;
}

.no-data p {
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 16px;
}

/* Responsive Styles */
@media (max-width: 991px) {
  .metrics-left {
    padding-right: 0;
    border-right: none;
  }

  .metrics-right {
    border-left: none;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    padding-left: 0;
    padding-top: 24px;
    margin-top: 24px;
  }
}

@media (max-width: 768px) {
  .node-details-container {
    padding: 0;
  }

  .info-card :deep(.ant-card-body),
  .metrics-card :deep(.ant-card-body),
  .chart-card :deep(.ant-card-body) {
    padding: 16px;
  }

  .gpu-name {
    font-size: 18px;
  }

  .status-icon {
    width: 40px;
    height: 40px;
    font-size: 24px;
  }

  .metric-value {
    font-size: 20px;
  }

  .reward-highlight-value {
    font-size: 28px;
  }

  .delegator-count {
    font-size: 28px;
  }
}

@media (max-width: 576px) {
  .metric-value {
    font-size: 18px;
  }

  .metric-label {
    font-size: 11px;
  }

  .reward-highlight-value {
    font-size: 24px;
  }

  .score-box :deep(.ant-progress) {
    transform: scale(0.85);
  }
}
</style>
