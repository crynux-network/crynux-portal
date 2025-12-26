<script setup>
import { ref, computed } from 'vue'
import {
  Modal as AModal,
  Form as AForm,
  FormItem as AFormItem,
  InputNumber as AInputNumber,
  TypographyText as ATypographyText,
  Tag as ATag,
  Spin as ASpin,
  message
} from 'ant-design-vue'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'
import delegatedStakingService from '@/services/delegated-staking'
import { isUserRejectedError, getBalanceForNetwork, getBeneficialAddress, isZeroAddress } from '@/services/contract'
import { formatBigInt18Precise } from '@/services/token'
import NetworkTag from '@/components/network-tag.vue'

const props = defineProps({
  nodeAddress: {
    type: String,
    default: ''
  },
  network: {
    type: String,
    default: ''
  },
  stakingAmount: {
    type: BigInt,
    default: 0n
  }
})

const emit = defineEmits(['success'])

const wallet = useWalletStore()

// Modal states
const isStakeModalOpen = ref(false)
const isUnstakeModalOpen = ref(false)
const isSubmitting = ref(false)

// Stake modal data
const stakeInputAmount = ref(null)
const minStakeAmount = ref(0n)
const networkBalanceWei = ref(0n)
const stakeBeneficialAddress = ref('')
const isStakeDataLoaded = ref(false)

// Unstake modal data
const beneficialAddress = ref('')
const isFetchingBeneficial = ref(false)
const isUnstakeDataLoaded = ref(false)

// Computed
const networkName = computed(() => {
  const key = props.network
  return (config.networks[key] && config.networks[key].chainName) || key
})

const currentStakingAmountCNX = computed(() => {
  const base = 10n ** 18n
  return Math.floor(Number(props.stakingAmount / base))
})

const gasReserveCNX = 0.01

const minStakeAmountCNX = computed(() => {
  const base = 10n ** 18n
  return Math.ceil(Number(minStakeAmount.value / base))
})

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

const availableWalletCNX = computed(() => {
  return Math.max(0, walletBalanceCNX.value - gasReserveCNX)
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
  if (!isStakeDataLoaded.value) return false
  if (isAmountInputDisabled.value) return false
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return false
  if (stakeAmountError.value) return false
  const amt = Number(stakeInputAmount.value)
  if (amt === currentStakingAmountCNX.value) return false
  return true
})

const hasEnoughGasForUnstake = computed(() => {
  return walletBalanceCNX.value >= gasReserveCNX
})

const formattedStakingAmount = computed(() => formatBigInt18Precise(props.stakingAmount))

// Refund detection for stake modal
const isReducingStake = computed(() => {
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return false
  const newAmount = Number(stakeInputAmount.value)
  return newAmount < currentStakingAmountCNX.value
})

const refundAmountCNX = computed(() => {
  if (!isReducingStake.value) return 0
  return currentStakingAmountCNX.value - Number(stakeInputAmount.value)
})

const stakeHasBeneficialAddress = computed(() => {
  return stakeBeneficialAddress.value && !isZeroAddress(stakeBeneficialAddress.value)
})

const stakeRefundDestinationAddress = computed(() => {
  if (stakeHasBeneficialAddress.value) {
    return stakeBeneficialAddress.value
  }
  return wallet.address || ''
})

const hasBeneficialAddress = computed(() => {
  return beneficialAddress.value && !isZeroAddress(beneficialAddress.value)
})

const unstakeDestinationAddress = computed(() => {
  if (hasBeneficialAddress.value) {
    return beneficialAddress.value
  }
  return wallet.address || ''
})

// Methods
async function fetchMinStakeAmount() {
  if (!props.network) return
  try {
    minStakeAmount.value = await delegatedStakingService.getMinStakeAmount(props.network)
  } catch (e) {
    console.error('Failed to fetch min stake amount:', e)
    minStakeAmount.value = 0n
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

async function fetchBeneficialAddress() {
  if (!wallet.address || !props.network) {
    beneficialAddress.value = ''
    return
  }
  isFetchingBeneficial.value = true
  try {
    beneficialAddress.value = await getBeneficialAddress(props.network, wallet.address)
  } finally {
    isFetchingBeneficial.value = false
  }
}

async function fetchStakeBeneficialAddress() {
  if (!wallet.address || !props.network) {
    stakeBeneficialAddress.value = ''
    return
  }
  try {
    stakeBeneficialAddress.value = await getBeneficialAddress(props.network, wallet.address)
  } catch {
    stakeBeneficialAddress.value = ''
  }
}

async function openStake() {
  stakeInputAmount.value = currentStakingAmountCNX.value > 0 ? currentStakingAmountCNX.value : null
  isStakeDataLoaded.value = false
  isStakeModalOpen.value = true
  await Promise.all([fetchMinStakeAmount(), fetchNetworkBalance(), fetchStakeBeneficialAddress()])
  isStakeDataLoaded.value = true
}

async function openUnstake() {
  isUnstakeDataLoaded.value = false
  isUnstakeModalOpen.value = true
  await Promise.all([fetchNetworkBalance(), fetchBeneficialAddress()])
  isUnstakeDataLoaded.value = true
}

function close() {
  isStakeModalOpen.value = false
  isUnstakeModalOpen.value = false
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
    await delegatedStakingService.stake(props.network, props.nodeAddress, newAmount, additionalAmount)

    message.success('Stake successful')
    isStakeModalOpen.value = false
    emit('success')
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
    await delegatedStakingService.unstake(props.network, props.nodeAddress)

    message.success('Unstake successful')
    isUnstakeModalOpen.value = false
    emit('success')
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

// Expose methods to parent
defineExpose({
  openStake,
  openUnstake,
  close
})
</script>

<template>
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
    <a-spin :spinning="!isStakeDataLoaded" tip="Loading...">
      <a-form layout="vertical" :hide-required-mark="true" :style="{ marginTop: '24px', marginBottom: '32px' }">
        <a-form-item
          name="amount"
          :validate-status="isStakeDataLoaded && (isAmountInputDisabled || stakeAmountError) ? 'error' : undefined"
          :help="isStakeDataLoaded ? (isAmountInputDisabled ? 'Insufficient balance to meet the minimum after gas reserve.' : (stakeAmountError || undefined)) : undefined"
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
            :disabled="!isStakeDataLoaded || isAmountInputDisabled"
          />
          <template #extra>
            <a-typography-text v-if="isStakeDataLoaded" type="secondary" style="font-size: 12px; display: block; margin-top: 12px;">Min: {{ minStakeAmountCNX.toLocaleString() }} CNX · Max: {{ maxStakeAmountCNX.toLocaleString() }} CNX</a-typography-text>
          </template>
        </a-form-item>
      </a-form>

      <div class="info-row">
        <span class="label">Blockchain</span>
        <NetworkTag :text="networkName" />
      </div>

      <div class="info-row">
        <span class="label">Node Address</span>
        <span class="value address">{{ nodeAddress }}</span>
      </div>

      <div class="info-row">
        <span class="label">Wallet Address</span>
        <span class="value address">{{ wallet.address }}</span>
      </div>

      <div class="info-row">
        <span class="label">Wallet Balance</span>
        <span class="value">{{ isStakeDataLoaded ? formattedWalletBalance : '...' }} CNX</span>
      </div>

      <!-- Refund notice when reducing stake -->
      <div v-if="isStakeDataLoaded && isReducingStake && !stakeAmountError" class="refund-info">
        <span class="label">{{ refundAmountCNX.toLocaleString() }} CNX will be refunded to:</span>
        <div class="destination-detail">
          <a-tag :color="stakeHasBeneficialAddress ? 'green' : 'red'">
            {{ stakeHasBeneficialAddress ? 'Beneficial' : 'Operational' }}
          </a-tag>
          <span class="destination-address">{{ stakeRefundDestinationAddress }}</span>
        </div>
      </div>
    </a-spin>
  </a-modal>

  <!-- Unstake Modal -->
  <a-modal
    v-model:open="isUnstakeModalOpen"
    title="Unstake from Node"
    :confirm-loading="isSubmitting"
    @ok="submitUnstake"
    ok-text="Confirm Unstake"
    cancel-text="Cancel"
    :ok-button-props="{ danger: true, disabled: !isUnstakeDataLoaded || !hasEnoughGasForUnstake }"
    :mask-closable="false"
  >
    <a-spin :spinning="!isUnstakeDataLoaded" tip="Loading...">
      <div class="unstake-content">
        <p class="warning-text">
          Are you sure you want to unstake all your tokens from this node?
        </p>
        <div class="info-row">
          <span class="label">Blockchain</span>
          <NetworkTag :text="networkName" />
        </div>
        <div class="info-row">
          <span class="label">Node Address</span>
          <span class="value address">{{ nodeAddress }}</span>
        </div>
        <div class="unstake-amount" style="margin-top: 16px;">
          <span class="label">Amount to unstake:</span>
          <span class="value">{{ formattedStakingAmount }} CNX</span>
        </div>
        <div class="destination-info">
          <span class="label">Funds will be sent to:</span>
          <div class="destination-detail">
            <a-tag :color="hasBeneficialAddress ? 'green' : 'red'">
              {{ hasBeneficialAddress ? 'Beneficial' : 'Operational' }}
            </a-tag>
            <span class="destination-address">{{ isUnstakeDataLoaded ? unstakeDestinationAddress : '...' }}</span>
          </div>
        </div>
        <div v-if="isUnstakeDataLoaded && !hasEnoughGasForUnstake" class="gas-warning">
          Insufficient wallet balance for gas fee.
        </div>
      </div>
    </a-spin>
  </a-modal>
</template>

<style scoped>
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin-top: 8px;
}

.info-row .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.info-row .value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.info-row .value.address {
  font-size: 12px;
  font-family: monospace;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.65);
  word-break: break-all;
  text-align: right;
  max-width: 70%;
}

.info-row :deep(.ant-tag) {
  margin-right: 0;
}

.unstake-content {
  padding: 8px 0;
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

.destination-info {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(22, 119, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(22, 119, 255, 0.1);
}

.destination-info .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
  display: block;
  margin-bottom: 8px;
}

.destination-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.destination-address {
  font-size: 12px;
  font-family: monospace;
  color: rgba(0, 0, 0, 0.65);
  word-break: break-all;
}

.refund-info {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(250, 173, 20, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(250, 173, 20, 0.2);
}

.refund-info .label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  display: block;
  margin-bottom: 8px;
}

.refund-info .destination-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.refund-info .destination-address {
  font-size: 12px;
  font-family: monospace;
  color: rgba(0, 0, 0, 0.65);
  word-break: break-all;
}
</style>
