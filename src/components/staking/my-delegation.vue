<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  Button as AButton,
  Spin as ASpin,
  InputNumber as AInputNumber,
  Modal as AModal,
  Form as AForm,
  FormItem as AFormItem,
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
import config from '@/config.json'
import delegatedStakingService from '@/services/delegated-staking'
import { isUserRejectedError, getBalanceForNetwork } from '@/services/contract'
import { formatBigInt18Precise, formatBigInt18Compact, toBigInt } from '@/services/token'
import NetworkTag from '@/components/network-tag.vue'

/**
 * Network Handling:
 * This component uses `props.network` (the node's blockchain) for all operations,
 * NOT `wallet.selectedNetworkKey`. This differs from other components in the app.
 *
 * - Reading data: Uses props.network for API calls (fetchDelegation, fetchMinStakeAmount)
 * - Sending transactions: Before stake/unstake, switches wallet store and MetaMask
 *   to match the node's network via ensureNetworkOnWallet()
 * - Wallet balance: Uses local `networkBalanceWei` ref fetched via getBalanceForNetwork()
 *   for props.network, NOT the global wallet.balanceWei (which is for selectedNetworkKey).
 *   This ensures accurate balance display and validation for the node's specific network.
 */

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
const minStakeAmount = ref(0n)
const networkBalanceWei = ref(0n)
const isStakeModalOpen = ref(false)
const isUnstakeModalOpen = ref(false)
const stakeInputAmount = ref(null)
const isSubmitting = ref(false)

const hasStaking = computed(() => stakingAmount.value > 0n)

const formattedStakedAt = computed(() => {
  if (!stakedAt.value) return '-'
  const date = new Date(stakedAt.value * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const networkName = computed(() => {
  const key = props.network
  return (config.networks[key] && config.networks[key].chainName) || key
})

const formattedStakingAmount = computed(() => formatBigInt18Compact(stakingAmount.value))
const formattedStakingAmountPrecise = computed(() => formatBigInt18Precise(stakingAmount.value))

const currentStakingAmountCNX = computed(() => {
  const base = 10n ** 18n
  return Math.floor(Number(stakingAmount.value / base))
})

const gasReserveCNX = 0.01

const walletBalanceCNX = computed(() => {
  try {
    const balBn = networkBalanceWei.value
    const base = 10n ** 18n
    const integer = Number(balBn / base)
    const remainder = Number(balBn % base) / 1e18
    return integer + remainder
  } catch {
    return 0
  }
})

const hasEnoughGasForUnstake = computed(() => {
  return walletBalanceCNX.value >= gasReserveCNX
})

const minStakeAmountCNX = computed(() => {
  const base = 10n ** 18n
  return Math.ceil(Number(minStakeAmount.value / base))
})

const availableWalletCNX = computed(() => {
  try {
    const balBn = networkBalanceWei.value
    const base = 10n ** 18n
    const integer = Number(balBn / base)
    const remainder = Number(balBn % base) / 1e18
    const balanceCNX = integer + remainder
    return Math.max(0, balanceCNX - gasReserveCNX)
  } catch {
    return 0
  }
})

const maxStakeAmountCNX = computed(() => {
  return Math.floor(currentStakingAmountCNX.value + availableWalletCNX.value)
})

const isAmountInputDisabled = computed(() => {
  return maxStakeAmountCNX.value < minStakeAmountCNX.value
})

const formattedWalletBalance = computed(() => {
  try {
    return formatBigInt18Precise(networkBalanceWei.value)
  } catch {
    return '0.0000'
  }
})

const stakeAmountError = computed(() => {
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return ''
  const amt = Number(stakeInputAmount.value)
  if (!Number.isInteger(amt)) return 'Amount must be an integer'
  if (amt <= 0) return 'Enter a valid amount'
  if (amt < minStakeAmountCNX.value) return `Minimum is ${minStakeAmountCNX.value} CNX`
  if (amt > maxStakeAmountCNX.value) return 'Exceeds maximum available'
  return ''
})

const isStakeValid = computed(() => {
  if (isAmountInputDisabled.value) return false
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return false
  if (stakeAmountError.value) return false
  const amt = Number(stakeInputAmount.value)
  if (amt === currentStakingAmountCNX.value) return false
  return true
})

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

async function fetchMinStakeAmount() {
  if (!props.network) return
  try {
    minStakeAmount.value = await delegatedStakingService.getMinStakeAmount(props.network)
  } catch (e) {
    console.error('Failed to fetch min stake amount:', e)
    minStakeAmount.value = 0n
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

async function fetchNetworkBalance() {
  if (!wallet.address || !props.network) {
    networkBalanceWei.value = 0n
    return
  }
  try {
    networkBalanceWei.value = await getBalanceForNetwork(props.network, wallet.address)
  } catch (e) {
    console.error('Failed to fetch network balance:', e)
    networkBalanceWei.value = 0n
  }
}

async function openStakeModal() {
  await fetchNetworkBalance()
  stakeInputAmount.value = currentStakingAmountCNX.value > 0 ? currentStakingAmountCNX.value : null
  isStakeModalOpen.value = true
}

async function openUnstakeModal() {
  await fetchNetworkBalance()
  isUnstakeModalOpen.value = true
}

async function submitStake() {
  if (!window.ethereum) {
    message.error('No wallet provider')
    return
  }
  if (!isStakeValid.value) {
    message.error('Invalid stake amount')
    return
  }

  const newAmount = Number(stakeInputAmount.value)
  const currentAmount = currentStakingAmountCNX.value
  const additionalAmount = Math.max(0, newAmount - currentAmount)

  isSubmitting.value = true
  try {
    await wallet.ensureNetworkOnWallet(props.network)
    await delegatedStakingService.stake(props.network, props.nodeAddress, newAmount, additionalAmount)

    window.location.reload()
  } catch (e) {
    console.error('Stake error:', e)
    if (isUserRejectedError(e)) {
      message.error('Transaction rejected')
    } else {
      message.error('Staking failed: ' + (e.reason || e.message || 'Unknown error'))
    }
  } finally {
    isSubmitting.value = false
  }
}

async function submitUnstake() {
  if (!window.ethereum) {
    message.error('No wallet provider')
    return
  }

  isSubmitting.value = true
  try {
    await wallet.ensureNetworkOnWallet(props.network)
    await delegatedStakingService.unstake(props.network, props.nodeAddress)

    message.success('Unstake successful')
    isUnstakeModalOpen.value = false
    await fetchDelegation()
    await wallet.refreshAccountAndBalance()
    emit('staking-changed')
  } catch (e) {
    console.error('Unstake error:', e)
    if (isUserRejectedError(e)) {
      message.error('Transaction rejected')
    } else {
      message.error('Unstake failed: ' + (e.reason || e.message || 'Unknown error'))
    }
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated && props.network) {
      fetchDelegation()
      fetchMinStakeAmount()
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
      fetchMinStakeAmount()
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
  if (props.network) {
    fetchMinStakeAmount()
    if (auth.isAuthenticated) {
      fetchDelegation()
    }
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

    <!-- Stake Modal -->
    <a-modal
      v-model:open="isStakeModalOpen"
      title="Stake on Node"
      :confirm-loading="isSubmitting"
      @ok="submitStake"
      :ok-button-props="{ disabled: !isStakeValid }"
      :mask-closable="false"
      :width="520"
      ok-text="Stake"
    >
      <a-form layout="vertical" :hide-required-mark="true" :style="{ marginTop: '24px', marginBottom: '32px' }">
        <a-form-item
          name="amount"
          :validate-status="isAmountInputDisabled || stakeAmountError ? 'error' : undefined"
          :help="isAmountInputDisabled ? 'Insufficient balance to meet the minimum after gas reserve.' : (stakeAmountError || undefined)"
          :style="{ marginBottom: '32px' }"
        >
          <a-input-number
            v-model:value="stakeInputAmount"
            :min="0"
            :step="1"
            :controls="false"
            :precision="0"
            style="width: 100%"
            placeholder="Enter amount"
            addon-before="CNX"
            :disabled="isAmountInputDisabled"
          />
          <template #extra>
            <a-typography-text type="secondary" style="font-size: 12px; display: block; margin-top: 12px;">Min: {{ minStakeAmountCNX.toLocaleString() }} CNX · Max: {{ maxStakeAmountCNX.toLocaleString() }} CNX</a-typography-text>
          </template>
        </a-form-item>
      </a-form>

      <div class="current-blockchain">
        <span class="label">Blockchain</span>
        <NetworkTag :text="networkName" />
      </div>

      <div class="wallet-address">
        <span class="label">Wallet Address</span>
        <span class="value">{{ wallet.address }}</span>
      </div>

      <div class="wallet-balance">
        <span class="label">Wallet Balance</span>
        <span class="value">{{ formattedWalletBalance }} CNX</span>
      </div>
    </a-modal>

    <!-- Unstake Modal -->
    <a-modal
      v-model:open="isUnstakeModalOpen"
      title="Unstake from Node"
      :confirm-loading="isSubmitting"
      @ok="submitUnstake"
      ok-text="Confirm Unstake"
      cancel-text="Cancel"
      :ok-button-props="{ danger: true, disabled: !hasEnoughGasForUnstake }"
    >
      <div class="unstake-modal-content">
        <p class="warning-text">
          Are you sure you want to unstake all your tokens from this node?
        </p>
        <div class="unstake-amount">
          <span class="label">Amount to unstake:</span>
          <span class="value">{{ formattedStakingAmountPrecise }} CNX</span>
        </div>
        <div v-if="!hasEnoughGasForUnstake" class="gas-warning">
          Insufficient wallet balance for gas fee.
        </div>
      </div>
    </a-modal>
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

/* Modal Styles */
.unstake-modal-content {
  padding: 8px 0;
}

.current-blockchain {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin-top: 8px;
}

.current-blockchain .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.current-blockchain :deep(.ant-tag) {
  margin-right: 0;
}

.wallet-address {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin-top: 8px;
}

.wallet-address .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.wallet-address .value {
  font-size: 12px;
  font-family: monospace;
  color: rgba(0, 0, 0, 0.65);
  word-break: break-all;
  text-align: right;
  max-width: 70%;
}

.wallet-balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin-top: 8px;
}

.wallet-balance .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.wallet-balance .value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.warning-text {
  color: rgba(0, 0, 0, 0.65);
  font-size: 14px;
  margin-bottom: 16px;
}

.unstake-amount {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(255, 77, 79, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 77, 79, 0.1);
}

.unstake-amount .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.unstake-amount .value {
  font-size: 18px;
  font-weight: 700;
  color: #ff4d4f;
}

.gas-warning {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 77, 79, 0.06);
  border-radius: 6px;
  color: #ff4d4f;
  font-size: 13px;
}
</style>
