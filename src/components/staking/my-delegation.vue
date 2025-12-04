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
  PlusOutlined,
  MinusOutlined,
  WalletOutlined
} from '@ant-design/icons-vue'
import { ethers } from 'ethers'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import { walletAPI } from '@/api/v1/wallet'
import config from '@/config.json'
import delegatedStakingService from '@/services/delegated-staking'
import { isUserRejectedError, formatBigInt18, formatBigInt18Compact, getNativeCurrencySymbol } from '@/services/contract'

const props = defineProps({
  nodeAddress: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['staking-changed'])

const wallet = useWalletStore()
const auth = useAuthStore()

const loading = ref(false)
const stakingAmount = ref(0n)
const minStakeAmount = ref(0n)
const isStakeModalOpen = ref(false)
const isUnstakeModalOpen = ref(false)
const stakeInputAmount = ref(null)
const isSubmitting = ref(false)

let isAuthenticating = false

const hasStaking = computed(() => stakingAmount.value > 0n)

const nativeCurrency = computed(() => getNativeCurrencySymbol(wallet.selectedNetworkKey))

const formattedStakingAmount = computed(() => formatBigInt18(stakingAmount.value))
const formattedMinStakeAmount = computed(() => formatBigInt18Compact(minStakeAmount.value))

const minStakeAmountCNX = computed(() => {
  const base = 10n ** 18n
  return Number(minStakeAmount.value / base)
})

const maxStakeAmountCNX = computed(() => {
  try {
    const balBn = BigInt(wallet.balanceWei || '0x0')
    const base = 10n ** 18n
    return Math.floor(Number(balBn / base))
  } catch {
    return 0
  }
})

const stakeAmountError = computed(() => {
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return ''
  const amt = Number(stakeInputAmount.value)
  if (!Number.isFinite(amt) || amt <= 0) return 'Enter a valid amount'
  if (amt < minStakeAmountCNX.value) return `Minimum stake is ${formattedMinStakeAmount.value} ${nativeCurrency.value}`
  if (amt > maxStakeAmountCNX.value) return 'Exceeds wallet balance'
  return ''
})

const isStakeValid = computed(() => {
  if (stakeInputAmount.value === null || stakeInputAmount.value === undefined || stakeInputAmount.value === '') return false
  return !stakeAmountError.value
})

async function refreshAccountAndBalance() {
  const provider = window.ethereum
  if (!provider) return
  const accounts = await provider.request({ method: 'eth_accounts' })
  let address = accounts && accounts.length ? accounts[0] : null
  if (address) {
    try {
      address = ethers.getAddress(address)
    } catch {
      address = null
    }
  }
  wallet.setAccount(address)
  if (address) {
    let chainId = null
    try {
      chainId = await provider.request({ method: 'eth_chainId' })
    } catch {
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
  return provider
    .request({ method: 'eth_requestAccounts' })
    .then((accounts) => {
      const acct = accounts && accounts.length ? accounts[0] : null
      if (!acct) throw new Error('No account connected')
      const addressToAuth = ethers.getAddress(acct)
      const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${addressToAuth}\nTimestamp: ${timestamp}`
      return provider
        .request({
          method: 'personal_sign',
          params: [messageToSign, addressToAuth]
        })
        .then((signature) => ({ signature, addressToAuth }))
    })
    .then(({ signature, addressToAuth }) =>
      walletAPI.connectWallet({ address: addressToAuth, signature, timestamp }).then((resp) => ({ resp, addressToAuth }))
    )
    .then(({ resp, addressToAuth }) => {
      auth.setSession(resp.token, resp.expires_at, addressToAuth)
      wallet.setAccount(addressToAuth)
      return wallet
        .ensureNetworkOnWallet(wallet.selectedNetworkKey)
        .then(() => refreshAccountAndBalance())
        .then(() => {
          message.success('Wallet connected')
          fetchDelegation()
        })
    })
    .catch(async (e) => {
      console.error('Authentication error:', e)
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
      } catch (err) {
        console.error('Failed to revoke wallet permissions:', err)
      }
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

async function fetchMinStakeAmount() {
  try {
    minStakeAmount.value = await delegatedStakingService.getMinStakeAmount(wallet.selectedNetworkKey)
  } catch (e) {
    console.error('Failed to fetch min stake amount:', e)
    minStakeAmount.value = 0n
  }
}

async function fetchDelegation() {
  if (!wallet.address || !props.nodeAddress) {
    stakingAmount.value = 0n
    return
  }
  loading.value = true
  try {
    stakingAmount.value = await delegatedStakingService.getDelegationStakingAmount(
      wallet.selectedNetworkKey,
      wallet.address,
      props.nodeAddress
    )
  } catch (e) {
    console.error('Failed to fetch delegation:', e)
    stakingAmount.value = 0n
  } finally {
    loading.value = false
  }
}

function openStakeModal() {
  stakeInputAmount.value = null
  isStakeModalOpen.value = true
}

function openUnstakeModal() {
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

  isSubmitting.value = true
  try {
    await wallet.ensureNetworkOnWallet()
    await delegatedStakingService.stake(wallet.selectedNetworkKey, props.nodeAddress, stakeInputAmount.value)

    message.success('Staking successful')
    isStakeModalOpen.value = false
    await fetchDelegation()
    await refreshAccountAndBalance()
    emit('staking-changed')
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
    await wallet.ensureNetworkOnWallet()
    await delegatedStakingService.unstake(wallet.selectedNetworkKey, props.nodeAddress)

    message.success('Unstake successful')
    isUnstakeModalOpen.value = false
    await fetchDelegation()
    await refreshAccountAndBalance()
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
  () => wallet.isConnected,
  (connected) => {
    if (connected) {
      fetchDelegation()
      fetchMinStakeAmount()
    } else {
      stakingAmount.value = 0n
    }
  }
)

watch(
  () => wallet.selectedNetworkKey,
  () => {
    if (wallet.isConnected) {
      fetchDelegation()
      fetchMinStakeAmount()
    }
  }
)

watch(
  () => props.nodeAddress,
  () => {
    if (wallet.isConnected) {
      fetchDelegation()
    }
  }
)

onMounted(() => {
  fetchMinStakeAmount()
  if (wallet.isConnected) {
    fetchDelegation()
  }
})
</script>

<template>
  <div class="my-delegation">
    <a-spin :spinning="loading">
      <!-- Not connected state -->
      <template v-if="!wallet.isConnected">
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
        <div class="staking-info">
          <div class="staking-detail">
            <span class="label">Staked Amount</span>
            <span class="value">{{ formattedStakingAmount }} {{ nativeCurrency }}</span>
          </div>
        </div>

        <div class="staking-actions">
          <a-button type="primary" @click="openStakeModal">
            <template #icon><plus-outlined /></template>
            Add Stake
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
      ok-text="Confirm Stake"
      cancel-text="Cancel"
    >
      <div class="stake-modal-content">
        <p class="modal-hint">
          Enter the amount of {{ nativeCurrency }} to stake on this node.
          <br />
          Minimum: {{ formattedMinStakeAmount }} {{ nativeCurrency }}
        </p>

        <a-form layout="vertical">
          <a-form-item
            label="Stake Amount"
            :validate-status="stakeAmountError ? 'error' : undefined"
            :help="stakeAmountError || undefined"
          >
            <a-input-number
              v-model:value="stakeInputAmount"
              :min="0"
              :max="maxStakeAmountCNX"
              :precision="0"
              style="width: 100%"
              :placeholder="`Enter amount (${nativeCurrency})`"
              :addon-after="nativeCurrency"
            />
          </a-form-item>
        </a-form>

        <div class="wallet-balance">
          <span class="label">Wallet Balance:</span>
          <span class="value">{{ maxStakeAmountCNX.toLocaleString() }} {{ nativeCurrency }}</span>
        </div>
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
      :ok-button-props="{ danger: true }"
    >
      <div class="unstake-modal-content">
        <p class="warning-text">
          Are you sure you want to unstake all your tokens from this node?
        </p>
        <div class="unstake-amount">
          <span class="label">Amount to unstake:</span>
          <span class="value">{{ formattedStakingAmount }} {{ nativeCurrency }}</span>
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
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}

.staking-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.staking-actions .ant-btn {
  flex: 1;
}

/* Modal Styles */
.stake-modal-content,
.unstake-modal-content {
  padding: 8px 0;
}

.modal-hint {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.6;
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
</style>
