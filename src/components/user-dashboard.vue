<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'
import { ethers } from 'ethers'
import { QuestionCircleOutlined, CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

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
const relayBalance = ref(1234.567891)
const recentWithdrawals = ref([
    { status: 'Success', time: '2025-09-03 10:12:45 UTC', amount: '25.123456', hash: '0x5e1b3a9f8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f' },
    { status: 'Pending', time: '2025-09-03 09:55:10 UTC', amount: '4.000000', hash: '' },
    { status: 'Failed', time: '2025-09-02 17:21:03 UTC', amount: '1.500000', hash: '' },
    { status: 'Processing', time: '2025-09-01 08:00:00 UTC', amount: '100.000000', hash: '' }
])

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

const explorerBase = computed(() => {
    const base = currentNetwork.value?.blockExplorerUrls?.[0] || ''
    return base || ''
})

const txUrlFor = (hash) => {
    const base = explorerBase.value?.trim()
    if (!base) return ''
    const normalized = base.replace(/\/+$/, '')
    return `${normalized}/tx/${hash}`
}

const tagColor = (status) => {
    if (status === 'Success') return 'success'
    if (status === 'Pending') return 'warning'
    if (status === 'Failed') return 'error'
    if (status === 'Processing') return 'processing'
    return 'default'
}

const copyTx = async (hash) => {
    try {
        await navigator.clipboard.writeText(hash)
        message.success('Tx hash copied')
    } catch {
        message.error('Copy failed')
    }
}

const shortenHash = (hash) => {
    if (!hash) return ''
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}

onMounted(async () => {
	if (wallet.address) {
		await wallet.fetchBalance()
	}
	await fetchBenefitAddress()
})

watch(() => [wallet.address, wallet.selectedNetworkKey, contractAddress.value], async () => {
	await fetchBenefitAddress()
})
</script>

<template>
    <a-row class="top-row"></a-row>
	<a-row :gutter="[16, 16]">
		<a-col :span="20" :offset="2">
			<a-card :title="`On-chain Wallet`" :bordered="false" style="height: 100%; opacity: 0.9">
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
	</a-row>

	<a-row :gutter="[16, 16]" style="margin-top: 8px;">
		<a-col :span="20" :offset="2">
			<a-card :title="`Relay Account`" :bordered="false">
				<a-row justify="space-between" align="middle">
					<a-col>
						<a-statistic title="Balance" :value="relayBalance" :precision="6" :value-style="{ fontSize: '32px' }" />
					</a-col>
					<a-col>
						<a-space>
							<a-button type="primary" @click="withdrawRelay">Withdraw</a-button>
						</a-space>
					</a-col>
				</a-row>
				<a-divider orientation="left" style="margin-top: 24px;">Recent Withdrawals</a-divider>
				<a-table v-if="recentWithdrawals.length > 0" :data-source="recentWithdrawals" :pagination="false" row-key="hash" size="small">
					<a-table-column key="status" title="Status">
						<template #default="{ record }">
							<a-tag :color="tagColor(record.status)">{{ record.status }}</a-tag>
						</template>
					</a-table-column>
					<a-table-column key="time" title="Time" data-index="time" />
					<a-table-column key="amount" title="Amount">
						<template #default="{ record }">
							{{ record.amount }} {{ tokenSymbol }}
						</template>
					</a-table-column>
					<a-table-column key="hash" title="Tx Hash">
						<template #default="{ record }">
							<template v-if="record.status === 'Success' && record.hash">
								<a-space>
									<span>{{ shortenHash(record.hash) }}</span>
									<a-button size="small" type="text" shape="circle" @click="copyTx(record.hash)">
										<template #icon><CopyOutlined /></template>
									</a-button>
									<a-button size="small" type="link" :href="txUrlFor(record.hash)" target="_blank" v-if="txUrlFor(record.hash)">View</a-button>
								</a-space>
							</template>
							<template v-else>-</template>
						</template>
					</a-table-column>
				</a-table>
				<a-empty v-else description="No withdrawals yet" />
			</a-card>
		</a-col>
	</a-row>

	<a-modal v-model:open="isModalOpen" :title="'Set Beneficial Address'" :confirm-loading="isSubmitting" @ok="submitSetBenefit" :ok-button-props="{ disabled: benefitAddress && !isZeroAddress(benefitAddress) }">
		<div style="margin-bottom: 12px;">Current network: {{ networkName }}</div>
		<a-alert type="warning" show-icon style="margin-bottom: 12px;">
			<template #description>
				<div>1) Keep the private key of this address safe and backed up.</div>
				<div>2) Once set, this address cannot be changed.</div>
			</template>
		</a-alert>
		<div v-if="benefitAddress && !isZeroAddress(benefitAddress)">
			Already set: {{ benefitAddress }}
		</div>
		<div v-else>
			<a-input v-model:value="inputBenefitAddress" placeholder="0x..." />
		</div>
	</a-modal>
</template>

<style scoped lang="stylus">
.top-row
    height 20px
</style>
