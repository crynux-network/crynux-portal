<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'
import { ethers } from 'ethers'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { walletAPI } from '@/api/v1/wallet'

const wallet = useWalletStore()



const networkName = computed(() => {
	const key = wallet.selectedNetworkKey
	return (config.networks[key] && config.networks[key].chainName) || key
})

const currentNetwork = computed(() => {
	return config.networks[wallet.selectedNetworkKey] || {}
})

const contractAddress = computed(() => {
	return currentNetwork.value?.benefitContractAddress || ''
})

const tokenSymbol = computed(() => {
	const key = wallet.selectedNetworkKey
	return (config.networks[key] && config.networks[key].nativeCurrency && config.networks[key].nativeCurrency.symbol) || ''
})

const formattedBalance = computed(() => {
	const hex = wallet.balanceWei || '0x0'
	let bn = 0n
	try { bn = BigInt(hex) } catch { bn = 0n }
	const d = BigInt((config.networks[wallet.selectedNetworkKey]?.nativeCurrency?.decimals) ?? 18)
	const decimals = d > 0n ? d : 18n
	const base = 10n ** decimals
	const integer = bn / base
	const target = 6n
	let fraction = 0n
	if (decimals >= target) {
		const scaleDown = 10n ** (decimals - target)
		fraction = (bn % base) / scaleDown
	} else {
		const scaleUp = 10n ** (target - decimals)
		fraction = (bn % base) * scaleUp
	}
	const fracStr = fraction.toString().padStart(6, '0')
	return `${integer.toString()}.${fracStr}`
})

const abi = [
	{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
	{ "inputs": [ { "internalType": "address", "name": "owner", "type": "address" } ], "name": "OwnableInvalidOwner", "type": "error" },
	{ "inputs": [ { "internalType": "address", "name": "account", "type": "address" } ], "name": "OwnableUnauthorizedAccount", "type": "error" },
	{ "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "nodeAddress", "type": "address" }, { "indexed": true, "internalType": "address", "name": "benefitAddress", "type": "address" } ], "name": "BenefitAddressSet", "type": "event" },
	{ "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" } ], "name": "OwnershipTransferred", "type": "event" },
	{ "inputs": [ { "internalType": "address", "name": "nodeAddress", "type": "address" } ], "name": "getBenefitAddress", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" },
	{ "inputs": [], "name": "owner", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" },
	{ "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
	{ "inputs": [ { "internalType": "address", "name": "benefitAddress", "type": "address" } ], "name": "setBenefitAddress", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
	{ "inputs": [ { "internalType": "address", "name": "newOwner", "type": "address" } ], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
]

const benefitAddress = ref('')
const isFetchingBenefit = ref(false)
const isModalOpen = ref(false)
const inputBenefitAddress = ref('')
const isSubmitting = ref(false)
const benefitError = ref('')
const relayBalance = ref(0)

const withdrawals = ref([])
const withdrawalsPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
})
const withdrawalsLoading = ref(false)
const withdrawalColumns = [
  {
    title: "Created At",
    dataIndex: "time",
    key: "time",
  },
  {
    title: "Amount",
    dataIndex: "amount",
    key: "amount",
  },
  {
    title: "Fee",
    dataIndex: "withdrawal_fee",
    key: "withdrawal_fee",
  },
  {
    title: "Network",
    dataIndex: "network",
    key: "network",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
  },
  {
    title: "Tx Hash",
    dataIndex: "tx_hash",
    key: "tx_hash",
  },
]

const truncateTxHash = (h) => {
    if (!h) return ''
    const s = String(h)
    if (s.length <= 18) return s
    return s.slice(0, 10) + '...' + s.slice(-8)
}

const formatNetworkName = (n) => {
    if (!n) return ''
    const s = String(n).toLowerCase()
    if (s === 'dymension') return 'Dymension'
    if (s === 'near') return 'Near'
    return n
}

const getNetworkTagColor = (n) => {
	const s = String(n || '').toLowerCase()
	if (s.includes('dym')) return 'geekblue'
	if (s.includes('near')) return 'green'
	return undefined
}

const getWithdrawals = async (page = 1, pageSize = 10) => {
  if (!wallet.address) {
    return;
  }
  withdrawalsLoading.value = true;
  try {
    const res = await walletAPI.getWithdrawals(wallet.address, page, pageSize);
    withdrawals.value = res.withdraw_records.map((record) => {
      const hasAmount = record && record.amount !== undefined && record.amount !== null
      const formattedAmount = hasAmount ? Number(ethers.formatEther(record.amount)).toFixed(6) : ''
      const rawFee = record && (record.withdrawal_fee ?? record.fee ?? record.withdraw_fee ?? record.service_fee)
      const hasFee = rawFee !== undefined && rawFee !== null
      let formattedFee = ''
      if (hasFee) {
        try { formattedFee = Number(ethers.formatEther(rawFee)).toFixed(6) } catch { formattedFee = '' }
      }
      return {
        ...record,
        time: (record && (record.time || record.created_at)) || '',
        amount: hasAmount ? ("CNX " + formattedAmount) : '',
        withdrawal_fee: hasFee ? ("CNX " + formattedFee) : '',
        network: formatNetworkName((record && record.network) || ''),
        status: (record && record.status) || '',
        tx_hash: (record && (record.tx_hash || record.txHash)) || '',
      }
    });
    withdrawalsPagination.value.total = res.total;
    withdrawalsPagination.value.current = page;
  } catch (e) {
    message.error(e.message);
  } finally {
    withdrawalsLoading.value = false;
  }
}

const handleWithdrawalsTableChange = (pagination) => {
  getWithdrawals(pagination.current, pagination.pageSize);
}


const fetchRelayBalance = async () => {
    if (!wallet.address) {
        relayBalance.value = 0
        return
    }
    try {
        const balanceInWei = await walletAPI.getRelayAccount(wallet.address)
        relayBalance.value = parseFloat(ethers.formatEther(balanceInWei || '0'))
    } catch (e) {
        console.error(e)
        relayBalance.value = 0
        message.error('Failed to fetch relay account balance')
    }
}

const isZeroAddress = (addr) => {
	if (!addr) return true
	try { return ethers.ZeroAddress.toLowerCase() === String(addr).toLowerCase() } catch { return false }
}

const fetchBenefitAddress = async () => {
	benefitError.value = ''
	isFetchingBenefit.value = true
	if (!contractAddress.value) {
		benefitError.value = 'Failed to load. Please refresh the page.'
		isFetchingBenefit.value = false
		return
	}
	if (!wallet.address || !window.ethereum) {
		benefitAddress.value = ''
		isFetchingBenefit.value = false
		return
	}
	try {
		const provider = new ethers.BrowserProvider(window.ethereum)
		const contract = new ethers.Contract(contractAddress.value, abi, provider)
		const addr = await contract.getBenefitAddress(wallet.address)
		benefitAddress.value = addr
	} catch (e) {
		console.error(e)
		benefitAddress.value = ''
		benefitError.value = 'Failed to load. Please refresh the page.'
	} finally {
		isFetchingBenefit.value = false
	}
}

const openSetModal = () => {
	inputBenefitAddress.value = ''
	isModalOpen.value = true
}

const submitSetBenefit = async () => {
	if (!window.ethereum) {
		message.error('No wallet provider')
		return
	}
	if (!contractAddress.value) {
		message.error('Contract not configured')
		return
	}
	if (!ethers.isAddress(inputBenefitAddress.value)) {
		message.error('Invalid address')
		return
	}
	isSubmitting.value = true
	try {
		await wallet.ensureNetworkOnWallet()
		const provider = new ethers.BrowserProvider(window.ethereum)
		const signer = await provider.getSigner()
		const contract = new ethers.Contract(contractAddress.value, abi, signer)
		const tx = await contract.setBenefitAddress(inputBenefitAddress.value)
		await tx.wait()
		message.success('Beneficial address set')
		isModalOpen.value = false
		await fetchBenefitAddress()
	} catch (e) {
		message.error('Failed to set address')
	} finally {
		isSubmitting.value = false
	}
}

const withdrawRelay = async () => {
    message.info('Withdraw pending integration')
}

onMounted(async () => {
	if (wallet.address) {
		await wallet.fetchBalance()
	}
	await fetchBenefitAddress()
    await fetchRelayBalance()
    await getWithdrawals()
})

watch(() => [wallet.address, wallet.selectedNetworkKey, contractAddress.value], async () => {
	await fetchBenefitAddress()
    await fetchRelayBalance()
    await getWithdrawals()
})
</script>

<template>
    <a-row class="top-row"></a-row>
	<a-row :gutter="[16, 16]">
		<a-col :span="20" :offset="2">
			<a-row :gutter="[16, 16]" align="stretch">
				<a-col :span="16" style="display: flex; flex-direction: column">
					<a-card :title="`On-chain Wallet`" :bordered="false" style="opacity: 0.9; width: 100%; flex: 1">
						<a-descriptions :column="1" bordered :label-style="{ 'width': '180px' }">
							<a-descriptions-item label="Network">{{ networkName }}</a-descriptions-item>
							<a-descriptions-item label="Address">{{ wallet.address }}</a-descriptions-item>
							<a-descriptions-item label="Balance">{{ tokenSymbol }} {{ formattedBalance }}</a-descriptions-item>
							<a-descriptions-item>
								<template #label>
									<span style="display: inline-flex; align-items: center; white-space: nowrap;">
										<span>Beneficial Address</span>
										<a-popover placement="right">
											<template #content>
												<div style="max-width: 300px;">
													<div>The beneficial address is a dedicated wallet for safely receiving your funds. For security, your operational address should not hold funds. All withdrawals, unstaking payouts, and emissions will be sent to this address. Choose a wallet you control and plan to keep using. Once set, this address is permanent and cannot be changed.</div>
													<div style="margin-top: 8px">If not set, the operational address will be used for payouts.</div>
												</div>
											</template>
											<QuestionCircleOutlined style="margin-left: 6px; color: #888; cursor: pointer;" />
										</a-popover>
									</span>
								</template>
								<div>
									<span v-if="isFetchingBenefit">Loading...</span>
									<template v-else>
										<span v-if="benefitError" style="color: #d4380d;">{{ benefitError }}</span>
										<span v-else-if="benefitAddress && !isZeroAddress(benefitAddress)">{{ benefitAddress }}</span>
										<span v-else>
											<span style="margin-right: 8px;">Not set</span>
											<a-button type="primary" size="small" @click="openSetModal">Set Beneficial Address</a-button>
										</span>
									</template>
								</div>
							</a-descriptions-item>
						</a-descriptions>
					</a-card>
				</a-col>
				<a-col :span="8" style="display: flex; flex-direction: column">
					<a-card :title="`Relay Account`" :bordered="false" style="opacity: 0.9; width: 100%; flex: 1; display: flex; flex-direction: column" :body-style="{ display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: '32px' }">
						<a-row justify="center" style="margin-top: 24px;">
							<a-col>
								<a-statistic title="Balance" :value="relayBalance" :precision="6" :value-style="{ fontSize: '32px' }" style="text-align: center" />
							</a-col>
						</a-row>
						<div style="margin-top: auto; text-align: center;">
							<a-button type="primary" size="large" @click="withdrawRelay" style="height: 48px; padding: 0 36px; font-size: 16px;">Withdraw</a-button>
						</div>
					</a-card>
				</a-col>
			</a-row>
		</a-col>
	</a-row>

	<a-row :gutter="[16, 16]" style="margin-top: 16px;">
		<a-col :span="20" :offset="2">
			<a-row :gutter="[16, 16]">
				<a-col :span="24">
					<a-card :title="`Withdrawals`" :bordered="false" style="opacity: 0.9">
						<a-table
                            :columns="withdrawalColumns"
                            :data-source="withdrawals"
                            :loading="withdrawalsLoading"
                            :pagination="withdrawalsPagination"
                            @change="handleWithdrawalsTableChange"
                            row-key="id"
                        >
							<template #bodyCell="{ column, record }">
								<template v-if="column.dataIndex === 'status'">
									<a-tag v-if="record.status === 0 || record.status === '0'" color="blue">Processing</a-tag>
									<a-tag v-else-if="record.status === 1 || record.status === '1'" color="green">Success</a-tag>
									<a-tag v-else-if="record.status === 2 || record.status === '2'" color="volcano">Failed</a-tag>
									<span v-else>{{ record.status }}</span>
								</template>
								<template v-else-if="column.dataIndex === 'network'">
									<a-tag :color="getNetworkTagColor(record.network)">
										Crynux on {{ record.network }}
									</a-tag>
								</template>
								<template v-else-if="column.dataIndex === 'tx_hash'">
									<span>{{ truncateTxHash(record.tx_hash) }}</span>
								</template>
							</template>
                        </a-table>
					</a-card>
				</a-col>
			</a-row>
		</a-col>
	</a-row>

	<a-modal v-model:open="isModalOpen" :title="'Set Beneficial Address'" :confirm-loading="isSubmitting" @ok="submitSetBenefit" :ok-button-props="{ disabled: benefitAddress && !isZeroAddress(benefitAddress) }" :mask-closable="false">
		<a-alert type="warning" show-icon style="margin-bottom: 12px;" message="Keep the private key of this address safe and backed up." />
		<a-alert type="warning" show-icon style="margin-bottom: 12px;" message="Once set, this address cannot be changed." />
		<div v-if="benefitAddress && !isZeroAddress(benefitAddress)">
			Already set: {{ benefitAddress }}
		</div>
		<div v-else>
			<a-form layout="vertical">
				<a-form-item label="Beneficial Address">
					<a-input v-model:value="inputBenefitAddress" placeholder="0x..." />
				</a-form-item>
				<a-form-item label="Current Network">
					<a-tag :color="getNetworkTagColor(networkName)">{{ networkName }}</a-tag>
				</a-form-item>
			</a-form>
		</div>
	</a-modal>
</template>

<style scoped lang="stylus">
.top-row
    height 20px
</style>
