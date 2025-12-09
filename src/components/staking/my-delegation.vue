<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  Button as AButton,
  Spin as ASpin,
  message
} from 'ant-design-vue'
import {
  DollarOutlined,
  EditOutlined,
  MinusOutlined,
  WalletOutlined
} from '@ant-design/icons-vue'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { walletAPI } from '@/api/v1/wallet'
import ApiError from '@/api/api-error'
import { formatBigInt18Compact, toBigInt } from '@/services/token'
import DelegationModals from '@/components/delegation-modals.vue'

const props = defineProps({
  nodeAddress: {
    type: String,
    required: true
  },
  network: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['staking-changed'])

const wallet = useWalletStore()
const auth = useAuthStore()

const loading = ref(false)
const stakingAmount = ref(0n)
const stakedAt = ref(null)
const todayEarnings = ref(0n)
const totalEarnings = ref(0n)
const modalsRef = ref(null)

const hasStaking = computed(() => stakingAmount.value > 0n)

const formattedStakedAt = computed(() => {
  if (!stakedAt.value) return '-'
  const date = new Date(stakedAt.value * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const formattedStakingAmount = computed(() => formatBigInt18Compact(stakingAmount.value))

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
    fetchDelegation()
  }
}

async function fetchDelegation() {
  if (!wallet.address || !props.nodeAddress || !props.network) {
    stakingAmount.value = 0n
    stakedAt.value = null
    todayEarnings.value = 0n
    totalEarnings.value = 0n
    return
  }
  loading.value = true
  try {
    const resp = await walletAPI.getDelegation(wallet.address, props.nodeAddress, props.network)
    stakingAmount.value = toBigInt(resp.staking_amount || 0)
    stakedAt.value = resp.staked_at || null
    todayEarnings.value = toBigInt(resp.today_earnings || 0)
    totalEarnings.value = toBigInt(resp.total_earnings || 0)
  } catch (e) {
    if (!(e instanceof ApiError && e.type === ApiError.Type.NotFound)) {
      console.error('Failed to fetch delegation:', e)
    }
    stakingAmount.value = 0n
    stakedAt.value = null
    todayEarnings.value = 0n
    totalEarnings.value = 0n
  } finally {
    loading.value = false
  }
}

function openStakeModal() {
  modalsRef.value?.openStake()
}

function openUnstakeModal() {
  modalsRef.value?.openUnstake()
}

async function handleSuccess() {
  await fetchDelegation()
  await wallet.refreshAccountAndBalance()
  emit('staking-changed')
}

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated && props.network) {
      fetchDelegation()
    } else {
      stakingAmount.value = 0n
    }
  }
)

watch(
  () => props.network,
  () => {
    if (auth.isAuthenticated && props.network) {
      fetchDelegation()
    }
  }
)

watch(
  () => props.nodeAddress,
  () => {
    if (auth.isAuthenticated) {
      fetchDelegation()
    }
  }
)

onMounted(() => {
  if (props.network && auth.isAuthenticated) {
    fetchDelegation()
  }
})
</script>

<template>
  <div class="my-delegation">
    <a-spin :spinning="loading">
      <!-- Not connected state -->
      <template v-if="!auth.isAuthenticated">
        <div class="not-connected">
          <p>Connect your wallet to stake on this node</p>
          <a-button type="primary" @click="connect">
            <template #icon><wallet-outlined /></template>
            Connect Wallet
          </a-button>
        </div>
      </template>

      <!-- Connected but no staking -->
      <template v-else-if="!hasStaking">
        <div class="no-staking">
          <p>You haven't staked on this node yet</p>
          <a-button type="primary" @click="openStakeModal">
            <template #icon><dollar-outlined /></template>
            Stake Now
          </a-button>
        </div>
      </template>

      <!-- Has staking -->
      <template v-else>
        <div class="staking-compact">
          <div class="staking-left">
            <div class="staking-amount">{{ formattedStakingAmount }}</div>
            <div class="staking-amount-label">My Stake (CNX)</div>
          </div>
          <div class="staking-right">
            <div class="staking-right-row">
              <span class="right-label">Staked At</span>
              <span class="right-value">{{ formattedStakedAt }}</span>
            </div>
            <div class="staking-right-row">
              <span class="right-label">Rewards</span>
              <span class="right-value">{{ formatBigInt18Compact(todayEarnings) }} <span class="right-sub">today</span> / {{ formatBigInt18Compact(totalEarnings) }} <span class="right-sub">total</span></span>
            </div>
          </div>
        </div>

        <div class="staking-actions">
          <a-button type="primary" @click="openStakeModal">
            <template #icon><edit-outlined /></template>
            Change Stake
          </a-button>
          <a-button danger @click="openUnstakeModal">
            <template #icon><minus-outlined /></template>
            Unstake
          </a-button>
        </div>
      </template>
    </a-spin>

    <DelegationModals
      ref="modalsRef"
      :node-address="nodeAddress"
      :network="network"
      :staking-amount="stakingAmount"
      @success="handleSuccess"
    />
  </div>
</template>

<style scoped>
.my-delegation {
  margin-top: 0;
}

.not-connected,
.no-staking {
  text-align: center;
  padding: 32px 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.not-connected p,
.no-staking p {
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 16px;
  font-size: 13px;
}

.staking-compact {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(24, 144, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(24, 144, 255, 0.1);
}

.staking-left {
  flex-shrink: 0;
}

.staking-amount {
  font-size: 24px;
  font-weight: 700;
  color: #1890ff;
  line-height: 1.2;
}

.staking-amount-label {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 2px;
}

.staking-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}

.staking-right-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.staking-right-row .right-label {
  color: rgba(0, 0, 0, 0.35);
}

.staking-right-row .right-value {
  color: rgba(0, 0, 0, 0.65);
  font-weight: 500;
}

.staking-right-row .right-sub {
  color: rgba(0, 0, 0, 0.35);
  font-weight: 400;
}

.staking-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.staking-actions .ant-btn {
  flex: 1;
}
</style>
