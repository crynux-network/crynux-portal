import { defineStore } from 'pinia'
import config from '@/config.json'

export const useWalletStore = defineStore('wallet', {
	state: () => ({
		address: null,
		chainId: null,
		selectedNetworkKey: 'dymension',
		balanceWei: '0x0',
		isConnected: false
	}),
	getters: {
		selectedNetwork(state) {
			return config.networks[state.selectedNetworkKey]
		}
	},
	actions: {
		shortAddress() {
			if (!this.address) return ''
			return this.address.slice(0, 6) + '…' + this.address.slice(-4)
		},
		setSelectedNetwork(key) {
			if (!config.networks[key]) return
			this.selectedNetworkKey = key
		},
		setAccount(address) {
			this.address = address
			this.isConnected = !!address
		},
		setChainId(chainId) {
			this.chainId = chainId
		},
		setBalanceWei(weiHex) {
			this.balanceWei = weiHex || '0x0'
		},
		async ensureNetworkOnWallet(targetKey) {
			const key = targetKey || this.selectedNetworkKey
			const net = config.networks[key]
			if (!net) return false
			const provider = window.ethereum
			if (!provider) return false
			if (!net.chainId) return false
			let hexId = String(net.chainId)
			if (!hexId.startsWith('0x')) {
				hexId = '0x' + Number(hexId).toString(16)
			}
			try {
				await provider.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: hexId }]
				})
				return true
			} catch (err) {
				if (err && err.code === 4902) {
					try {
						const addParams = { ...net, chainId: hexId }
						await provider.request({
							method: 'wallet_addEthereumChain',
							params: [addParams]
						})
						return true
					} catch (_) {
						return false
					}
				}
				return false
			}
		},
		async fetchBalance() {
			const provider = window.ethereum
			if (!provider || !this.address) return '0x0'
			try {
				const bal = await provider.request({
					method: 'eth_getBalance',
					params: [this.address, 'latest']
				})
				this.setBalanceWei(bal)
				return bal
			} catch (_) {
				this.setBalanceWei('0x0')
				return '0x0'
			}
		}
	},
	persist: true
})
