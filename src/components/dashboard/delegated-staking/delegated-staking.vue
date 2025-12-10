<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Statistic as AStatistic,
  Spin as ASpin,
  Empty as AEmpty,
  Button as AButton,
  Dropdown as ADropdown,
  Tooltip as ATooltip,
  Pagination as APagination,
  message,
  Grid
} from 'ant-design-vue'
import {
  WalletOutlined,
  DownOutlined,
  UpOutlined,
  EditOutlined,
  MinusOutlined,
  MoreOutlined,
  DollarCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  MinusCircleOutlined as StoppedCircleOutlined
} from '@ant-design/icons-vue'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { walletAPI } from '@/api/v1/wallet'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import ApiError from '@/api/api-error'
import config from '@/config.json'
import { formatBigInt18Precise, toBigInt } from '@/services/token'
import NetworkTag from '@/components/network-tag.vue'
import DelegatorIncomeChart from './delegator-income-chart.vue'
import DelegationIncomeChart from './delegation-income-chart.vue'
import DelegationModals from '@/components/delegation-modals.vue'
import { useRouter } from 'vue-router'

const useBreakpoint = Grid.useBreakpoint
const screens = useBreakpoint()

const router = useRouter()
const wallet = useWalletStore()
const auth = useAuthStore()

const loading = ref(false)
const delegationNum = ref(0)
const totalStakingAmount = ref(0n)
const totalDelegationEarnings = ref(0n)
const delegations = ref([])
const expandedKey = ref(null)

// Pagination
const currentPage = ref(1)
const pageSize = 20
const totalDelegations = ref(0)

// Active modal state
const activeModalDelegation = ref(null)
const modalsRef = ref(null)

const hasData = computed(() => delegationNum.value > 0)

const statisticValueStyle = computed(() => {
  let fontSize = '28px'
  if (screens.value.xxl) {
    fontSize = '28px'
  } else if (screens.value.xl) {
    fontSize = '26px'
  } else if (screens.value.lg) {
    fontSize = '24px'
  } else if (screens.value.md) {
    fontSize = '22px'
  } else if (screens.value.sm) {
    fontSize = '20px'
  } else {
    fontSize = '18px'
  }
  return {
    color: '#1677ff',
    fontSize,
    textAlign: 'center'
  }
})

const formattedTotalStaking = computed(() => formatBigInt18Precise(totalStakingAmount.value))
const formattedTotalEarnings = computed(() => formatBigInt18Precise(totalDelegationEarnings.value))

function getNetworkName(networkKey) {
  return (config.networks[networkKey] && config.networks[networkKey].chainName) || networkKey
}

function normalizeStatus(status) {
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

function getStatusText(status) {
  const s = normalizeStatus(status)
  if (s === 'paused') return 'Node is paused'
  if (s === 'stopped') return 'Node is stopped'
  return 'Node is running'
}

function formatStakedAt(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function connect() {
  const result = await auth.authenticate()
  if (!result.success) {
    if (result.reason === 'no_provider') {
      message.error('Please install MetaMask in your browser.')
    } else if (result.reason === 'auth_failed') {
      message.error('Authentication failed or was rejected')
    }
  } else {
    message.success('Wallet connected')
    fetchData()
  }
}

async function fetchData(page = 1) {
  if (!wallet.address) {
    delegationNum.value = 0
    totalStakingAmount.value = 0n
    totalDelegationEarnings.value = 0n
    delegations.value = []
    totalDelegations.value = 0
    return
  }

  loading.value = true
  try {
    const [statsResp, listResp] = await Promise.all([
      walletAPI.getDelegatorStats(wallet.address),
      walletAPI.getDelegatorDelegations(wallet.address, page, pageSize)
    ])

    delegationNum.value = statsResp.delegation_num || 0
    totalStakingAmount.value = toBigInt(statsResp.total_staking_amount || 0)
    totalDelegationEarnings.value = toBigInt(statsResp.total_delegation_earnings || 0)
    totalDelegations.value = listResp?.total || 0
    currentPage.value = page

    const delegationsList = Array.isArray(listResp?.delegations) ? listResp.delegations : []

    // Get unique node addresses to fetch their current networks
    const uniqueNodeAddresses = [...new Set(delegationsList.map(item => item.node_address))]
    const nodeDetailsMap = {}

    // Fetch node details in parallel
    await Promise.all(
      uniqueNodeAddresses.map(async (nodeAddress) => {
        try {
          const nodeDetails = await v2DelegatedStakingAPI.getNodeDetails(nodeAddress)
          nodeDetailsMap[nodeAddress] = nodeDetails
        } catch (e) {
          console.error(`Failed to fetch node details for ${nodeAddress}:`, e)
          nodeDetailsMap[nodeAddress] = null
        }
      })
    )

    delegations.value = delegationsList.map((item, index) => {
      const nodeDetails = nodeDetailsMap[item.node_address]
      const nodeNetwork = nodeDetails?.network || null
      const nodeStatus = nodeDetails?.status ?? null
      const isActive = nodeNetwork === item.network

      return {
        key: `${item.node_address}-${item.network}-${index}`,
        nodeAddress: item.node_address,
        network: item.network,
        nodeNetwork: nodeNetwork,
        nodeStatus: nodeStatus,
        isActive: isActive,
        stakingAmount: toBigInt(item.staking_amount || 0),
        stakedAt: item.staked_at,
        totalEarnings: toBigInt(item.total_earnings || 0),
        todayEarnings: toBigInt(item.today_earnings || 0)
      }
    })
  } catch (e) {
    if (!(e instanceof ApiError && e.type === ApiError.Type.NotFound)) {
      console.error('Failed to fetch delegator data:', e)
    }
    delegationNum.value = 0
    totalStakingAmount.value = 0n
    totalDelegationEarnings.value = 0n
    delegations.value = []
    totalDelegations.value = 0
  } finally {
    loading.value = false
  }
}

function onPageChange(page) {
  fetchData(page)
}

function goToNodeDetails(nodeAddress) {
  const route = router.resolve({ name: 'node-details', params: { address: nodeAddress } })
  window.open(route.href, '_blank')
}

function toggleExpand(key) {
  expandedKey.value = expandedKey.value === key ? null : key
}

function isExpanded(key) {
  return expandedKey.value === key
}

function openStakeModal(delegation) {
  activeModalDelegation.value = delegation
  // Wait for next tick to ensure modals component has the new props
  setTimeout(() => {
    modalsRef.value?.openStake()
  }, 0)
}

function openUnstakeModal(delegation) {
  activeModalDelegation.value = delegation
  setTimeout(() => {
    modalsRef.value?.openUnstake()
  }, 0)
}

async function handleModalSuccess() {
  activeModalDelegation.value = null
  await fetchData()
  await wallet.refreshAccountAndBalance()
}

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      fetchData()
    } else {
      delegationNum.value = 0
      totalStakingAmount.value = 0n
      totalDelegationEarnings.value = 0n
      delegations.value = []
    }
  }
)

onMounted(() => {
  if (auth.isAuthenticated) {
    fetchData()
  }
})
</script>

<template>
  <div class="delegated-staking-page">
    <div class="top-spacer"></div>

    <!-- Not connected state -->
    <template v-if="!auth.isAuthenticated">
      <div class="not-connected">
        <wallet-outlined class="not-connected-icon" />
        <p>Connect your wallet to view staking details</p>
        <a-button type="primary" size="large" @click="connect">
          <template #icon><wallet-outlined /></template>
          Connect Wallet
        </a-button>
      </div>
    </template>

    <!-- Connected state -->
    <template v-else>
      <a-spin :spinning="loading">
        <!-- Statistics Cards -->
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :md="8">
            <a-card :bordered="false" class="stat-card">
              <a-statistic
                title="Total Stakes"
                :value="delegationNum"
                :value-style="statisticValueStyle"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-card :bordered="false" class="stat-card">
              <a-statistic
                title="Total Stake (CNX)"
                :value="formattedTotalStaking"
                :value-style="statisticValueStyle"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :md="8">
            <a-card :bordered="false" class="stat-card">
              <a-statistic
                title="Total Rewards (CNX)"
                :value="formattedTotalEarnings"
                :value-style="statisticValueStyle"
              />
            </a-card>
          </a-col>
        </a-row>

        <!-- Earnings Chart -->
        <a-row :gutter="[16, 16]" style="margin-top: 16px">
          <a-col :span="24">
            <a-card title="Staking Rewards" :bordered="false" class="chart-card">
              <DelegatorIncomeChart :address="wallet.address" :height="280" />
            </a-card>
          </a-col>
        </a-row>

        <!-- Delegations List -->
        <a-row :gutter="[16, 16]" style="margin-top: 16px">
          <a-col :span="24">
            <a-card title="My Stakes" :bordered="false" class="list-card">
              <a-empty v-if="!hasData && totalDelegations === 0" description="No stakes yet" />
              <div v-else class="delegations-list">
                <div
                  v-for="delegation in delegations"
                  :key="delegation.key"
                  class="delegation-card"
                >
                  <!-- Header Section -->
                  <div class="card-header">
                    <div class="header-left">
                      <span class="node-label">Node</span>
                      <span class="node-address" @click="goToNodeDetails(delegation.nodeAddress)">
                        {{ delegation.nodeAddress }}
                      </span>
                    </div>
                    <div class="header-actions">
                      <a-dropdown trigger="click">
                        <a-button type="text" class="more-btn">
                          <template #icon><more-outlined /></template>
                        </a-button>
                        <template #overlay>
                          <div class="action-menu">
                            <div class="action-menu-item" @click="openStakeModal(delegation)">
                              <edit-outlined />
                              <span>Change Stake</span>
                            </div>
                            <div class="action-menu-item danger" @click="openUnstakeModal(delegation)">
                              <minus-outlined />
                              <span>Unstake</span>
                            </div>
                          </div>
                        </template>
                      </a-dropdown>
                    </div>
                  </div>

                  <!-- Network & Status Row -->
                  <div :class="['network-status-row', { 'network-mismatch': !delegation.isActive }]">
                    <div class="status-icons">
                      <a-tooltip :title="getStatusText(delegation.nodeStatus)">
                        <span :class="['node-status-icon', normalizeStatus(delegation.nodeStatus)]">
                          <play-circle-outlined v-if="normalizeStatus(delegation.nodeStatus) === 'running'" />
                          <pause-circle-outlined v-else-if="normalizeStatus(delegation.nodeStatus) === 'paused'" />
                          <stopped-circle-outlined v-else />
                        </span>
                      </a-tooltip>
                      <a-tooltip :title="delegation.isActive ? 'Active: Stake network matches node current network' : 'Inactive: Stake network differs from node current network'">
                        <span :class="['status-indicator', delegation.isActive ? 'active' : 'inactive']">
                          <dollar-circle-outlined />
                        </span>
                      </a-tooltip>
                    </div>

                    <!-- Same network: show single tag -->
                    <div v-if="delegation.isActive" class="network-display">
                      <NetworkTag :text="getNetworkName(delegation.network)" />
                    </div>

                    <!-- Different networks: show both with alert style -->
                    <div v-else class="network-mismatch-display">
                      <div class="network-pair">
                        <span class="network-pair-label">Stake</span>
                        <NetworkTag :text="getNetworkName(delegation.network)" />
                      </div>
                      <span class="network-arrow">→</span>
                      <div class="network-pair">
                        <span class="network-pair-label">Node</span>
                        <NetworkTag v-if="delegation.nodeNetwork" :text="getNetworkName(delegation.nodeNetwork)" />
                        <span v-else class="network-unknown">Unknown</span>
                      </div>
                    </div>
                  </div>

                  <!-- Data Section -->
                  <div class="card-body">
                    <!-- Stake Section -->
                    <div class="data-section stake-section">
                      <div class="section-title">Stake</div>
                      <div class="data-grid">
                        <div class="data-item">
                          <span class="data-label">Amount</span>
                          <span class="data-value primary">{{ formatBigInt18Precise(delegation.stakingAmount) }} <span class="unit">CNX</span></span>
                        </div>
                        <div class="data-item">
                          <span class="data-label">Staked Since</span>
                          <span class="data-value">{{ formatStakedAt(delegation.stakedAt) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Divider -->
                    <div class="section-divider"></div>

                    <!-- Rewards Section -->
                    <div class="data-section rewards-section">
                      <div class="section-title">Rewards</div>
                      <div class="data-grid">
                        <div class="data-item">
                          <span class="data-label">Total Rewards</span>
                          <span class="data-value success">{{ formatBigInt18Precise(delegation.totalEarnings) }} <span class="unit">CNX</span></span>
                        </div>
                        <div class="data-item">
                          <span class="data-label">Today Rewards</span>
                          <span class="data-value highlight">+{{ formatBigInt18Precise(delegation.todayEarnings) }} <span class="unit">CNX</span></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Expand Toggle -->
                  <div class="card-footer" @click="toggleExpand(delegation.key)">
                    <span class="expand-text">{{ isExpanded(delegation.key) ? 'Hide Chart' : 'Show Rewards Chart' }}</span>
                    <up-outlined v-if="isExpanded(delegation.key)" class="expand-icon" />
                    <down-outlined v-else class="expand-icon" />
                  </div>

                  <!-- Expanded Chart -->
                  <div v-if="isExpanded(delegation.key)" class="card-chart">
                    <DelegationIncomeChart
                      :delegator-address="wallet.address"
                      :node-address="delegation.nodeAddress"
                      :network="delegation.network"
                      :height="220"
                    />
                  </div>
                </div>
              </div>

              <!-- Pagination -->
              <div v-if="totalDelegations > pageSize" class="pagination-wrapper">
                <a-pagination
                  :current="currentPage"
                  :page-size="pageSize"
                  :total="totalDelegations"
                  :show-size-changer="false"
                  :show-quick-jumper="totalDelegations > pageSize * 5"
                  show-less-items
                  @change="onPageChange"
                />
              </div>
            </a-card>
          </a-col>
        </a-row>
      </a-spin>
    </template>

    <!-- Staking Modals (shared) -->
    <DelegationModals
      v-if="activeModalDelegation"
      ref="modalsRef"
      :node-address="activeModalDelegation.nodeAddress"
      :network="activeModalDelegation.network"
      :staking-amount="activeModalDelegation.stakingAmount"
      @success="handleModalSuccess"
    />
  </div>
</template>

<style scoped lang="stylus">
.delegated-staking-page
  padding-bottom 32px

.top-spacer
  height 20px

.not-connected
  text-align center
  padding 80px 24px
  background rgba(0, 0, 0, 0.02)
  border-radius 12px

.not-connected-icon
  font-size 64px
  color rgba(0, 0, 0, 0.15)
  margin-bottom 24px

.not-connected p
  color rgba(0, 0, 0, 0.45)
  margin-bottom 24px
  font-size 16px

.stat-card
  opacity 0.9
  text-align center

.stat-card :deep(.ant-statistic-title)
  text-align center
  font-size 14px
  color rgba(0, 0, 0, 0.65)

.chart-card
  opacity 0.9

.list-card
  opacity 0.9

.pagination-wrapper
  display flex
  justify-content center
  margin-top 24px
  padding-top 16px
  border-top 1px solid rgba(0, 0, 0, 0.06)

.delegations-list
  display flex
  flex-direction column
  gap 16px

// Delegation Card
.delegation-card
  border 1px solid rgba(0, 0, 0, 0.08)
  border-radius 12px
  overflow hidden
  background #fff
  transition box-shadow 0.2s

.delegation-card:hover
  box-shadow 0 2px 8px rgba(0, 0, 0, 0.06)

// Card Header
.card-header
  display flex
  justify-content space-between
  align-items center
  padding 14px 20px
  background linear-gradient(to right, rgba(22, 119, 255, 0.06), rgba(22, 119, 255, 0.02))
  border-bottom 1px solid rgba(22, 119, 255, 0.08)

.header-left
  display flex
  align-items center
  gap 12px
  flex-wrap wrap

.header-actions
  display flex
  gap 8px

.more-btn
  width 32px
  height 32px
  display flex
  align-items center
  justify-content center
  border-radius 6px
  color rgba(0, 0, 0, 0.65)
  font-size 18px

.more-btn:hover
  background rgba(0, 0, 0, 0.04)
  color rgba(0, 0, 0, 0.85)

.action-menu
  background #fff
  border-radius 8px
  box-shadow 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)
  padding 4px
  min-width 140px

.action-menu-item
  display flex
  align-items center
  gap 8px
  padding 8px 12px
  border-radius 4px
  cursor pointer
  font-size 14px
  color rgba(0, 0, 0, 0.85)
  transition background 0.2s

.action-menu-item:hover
  background rgba(0, 0, 0, 0.04)

.action-menu-item.danger
  color #ff4d4f

.action-menu-item.danger:hover
  background rgba(255, 77, 79, 0.06)

.node-label
  font-size 12px
  color rgba(0, 0, 0, 0.45)
  font-weight 500

.node-address
  font-family 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace
  font-size 14px
  font-weight 600
  color #1677ff
  cursor pointer
  transition color 0.2s

.node-address:hover
  color #4096ff

// Node Status Icon
.node-status-icon
  display flex
  align-items center
  font-size 16px
  color rgba(0, 0, 0, 0.45)

.node-status-icon.running
  color #52c41a

.node-status-icon.paused
  color #faad14

.node-status-icon.stopped
  color rgba(0, 0, 0, 0.25)


// Network & Status Row
.network-status-row
  display flex
  align-items center
  gap 12px
  padding 10px 20px
  background rgba(0, 0, 0, 0.02)
  border-bottom 1px solid rgba(0, 0, 0, 0.06)

.network-status-row.network-mismatch
  background rgba(255, 77, 79, 0.04)
  border-bottom-color rgba(255, 77, 79, 0.1)

.status-icons
  display flex
  align-items center
  gap 6px

// Status Indicator
.status-indicator
  display flex
  align-items center
  font-size 16px

.status-indicator.active
  color #52c41a

.status-indicator.inactive
  color #ff4d4f

.network-display
  display flex
  align-items center

.network-mismatch-display
  display flex
  align-items center
  gap 8px
  padding 4px 12px
  background rgba(255, 77, 79, 0.08)
  border-radius 6px
  border 1px dashed rgba(255, 77, 79, 0.3)

.network-pair
  display flex
  align-items center
  gap 6px

.network-pair-label
  font-size 11px
  color rgba(0, 0, 0, 0.45)
  font-weight 500

.network-arrow
  color rgba(255, 77, 79, 0.6)
  font-size 12px
  font-weight 600

.network-unknown
  font-size 12px
  color rgba(0, 0, 0, 0.25)
  font-style italic

// Card Body
.card-body
  display flex
  padding 0

.data-section
  flex 1
  padding 20px 24px

.stake-section
  background #fff

.rewards-section
  background rgba(82, 196, 26, 0.04)

.section-title
  font-size 12px
  font-weight 600
  color rgba(0, 0, 0, 0.45)
  text-transform uppercase
  letter-spacing 0.5px
  margin-bottom 16px

.section-divider
  width 1px
  background linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.06), transparent)
  margin 12px 0

.data-grid
  display flex
  flex-direction column
  gap 14px

.data-item
  display flex
  justify-content space-between
  align-items baseline

.data-label
  font-size 13px
  color rgba(0, 0, 0, 0.55)

.data-value
  font-size 15px
  font-weight 600
  color rgba(0, 0, 0, 0.85)

.data-value.primary
  color #1677ff

.data-value.success
  color #52c41a

.data-value.highlight
  color #1677ff
  background rgba(22, 119, 255, 0.08)
  padding 2px 8px
  border-radius 4px
  font-size 13px

.data-value .unit
  font-weight 400
  font-size 12px
  color rgba(0, 0, 0, 0.45)
  margin-left 2px

// Card Footer (Expand Toggle)
.card-footer
  display flex
  justify-content center
  align-items center
  gap 6px
  padding 10px
  background rgba(0, 0, 0, 0.03)
  border-top 1px solid rgba(0, 0, 0, 0.06)
  cursor pointer
  transition background 0.2s

.card-footer:hover
  background rgba(0, 0, 0, 0.06)

.expand-text
  font-size 12px
  color rgba(0, 0, 0, 0.45)

.expand-icon
  font-size 10px
  color rgba(0, 0, 0, 0.35)

// Card Chart
.card-chart
  padding 20px 24px
  border-top 1px solid rgba(0, 0, 0, 0.04)
  background rgba(0, 0, 0, 0.01)

// Responsive
@media (max-width: 768px)
  .card-header
    flex-direction row
    align-items center
    padding 12px 16px

  .header-left
    flex 1
    min-width 0
    gap 8px

  .node-address
    font-size 12px
    word-break break-all

  .network-status-row
    flex-wrap wrap
    padding 8px 16px

  .network-mismatch-display
    flex-wrap wrap

  .card-body
    flex-direction column

  .section-divider
    width auto
    height 1px
    margin 0
    background linear-gradient(to right, transparent, rgba(0, 0, 0, 0.06), transparent)

  .rewards-section
    border-top 1px solid rgba(82, 196, 26, 0.1)
</style>
