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
  message,
  Grid
} from 'ant-design-vue'
import {
  WalletOutlined,
  DownOutlined,
  UpOutlined,
  EditOutlined,
  MinusOutlined,
  MoreOutlined
} from '@ant-design/icons-vue'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { walletAPI } from '@/api/v1/wallet'
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

// Active modal state
const activeModalDelegation = ref(null)
const modalsRef = ref(null)

const hasData = computed(() => delegationNum.value > 0)

const statisticValueStyle = computed(() => {
  let fontSize = '36px'
  if (screens.value.xs) {
    fontSize = '28px'
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

async function fetchData() {
  if (!wallet.address) {
    delegationNum.value = 0
    totalStakingAmount.value = 0n
    totalDelegationEarnings.value = 0n
    delegations.value = []
    return
  }

  loading.value = true
  try {
    const [statsResp, listResp] = await Promise.all([
      walletAPI.getDelegatorStats(wallet.address),
      walletAPI.getDelegatorDelegations(wallet.address)
    ])

    delegationNum.value = statsResp.delegation_num || 0
    totalStakingAmount.value = toBigInt(statsResp.total_staking_amount || 0)
    totalDelegationEarnings.value = toBigInt(statsResp.total_delegation_earnings || 0)

    const delegationsList = Array.isArray(listResp?.delegations) ? listResp.delegations : []
    delegations.value = delegationsList.map((item, index) => ({
      key: `${item.node_address}-${item.network}-${index}`,
      nodeAddress: item.node_address,
      network: item.network,
      stakingAmount: toBigInt(item.staking_amount || 0),
      stakedAt: item.staked_at,
      totalEarnings: toBigInt(item.total_earnings || 0),
      todayEarnings: toBigInt(item.today_earnings || 0)
    }))
  } catch (e) {
    if (!(e instanceof ApiError && e.type === ApiError.Type.NotFound)) {
      console.error('Failed to fetch delegator data:', e)
    }
    delegationNum.value = 0
    totalStakingAmount.value = 0n
    totalDelegationEarnings.value = 0n
    delegations.value = []
  } finally {
    loading.value = false
  }
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
        <p>Connect your wallet to view delegation details</p>
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
          <a-col :xs="24" :sm="8">
            <a-card :bordered="false" class="stat-card">
              <a-statistic
                title="Delegations"
                :value="delegationNum"
                :value-style="statisticValueStyle"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="8">
            <a-card :bordered="false" class="stat-card">
              <a-statistic
                title="Total Stake (CNX)"
                :value="formattedTotalStaking"
                :value-style="statisticValueStyle"
              />
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="8">
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
            <a-card title="Delegation Rewards" :bordered="false" class="chart-card">
              <DelegatorIncomeChart :address="wallet.address" :height="280" />
            </a-card>
          </a-col>
        </a-row>

        <!-- Delegations List -->
        <a-row :gutter="[16, 16]" style="margin-top: 16px">
          <a-col :span="24">
            <a-card title="Delegation List" :bordered="false" class="list-card">
              <a-empty v-if="!hasData" description="No delegations yet" />
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
                      <NetworkTag :text="getNetworkName(delegation.network)" />
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
            </a-card>
          </a-col>
        </a-row>
      </a-spin>
    </template>

    <!-- Delegation Modals (shared) -->
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
