<script setup>
import { computed, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'

const wallet = useWalletStore()

const networkName = computed(() => {
	const key = wallet.selectedNetworkKey
	return (config.networks[key] && config.networks[key].chainName) || key
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

onMounted(async () => {
	if (wallet.address) {
		await wallet.fetchBalance()
	}
})
</script>

<template>
	<a-row :gutter="[16, 16]">
		<a-col :span="20" :offset="2">
			<a-card :title="`On-chain Wallet`" :bordered="false" style="height: 100%; opacity: 0.9">
				<a-descriptions :column="1" bordered :label-style="{ 'width': '180px' }">
					<a-descriptions-item label="Network">{{ networkName }}</a-descriptions-item>
					<a-descriptions-item label="Address">{{ wallet.address }}</a-descriptions-item>
					<a-descriptions-item label="Balance">{{ tokenSymbol }} {{ formattedBalance }}</a-descriptions-item>
				</a-descriptions>
			</a-card>
		</a-col>
	</a-row>
</template>
