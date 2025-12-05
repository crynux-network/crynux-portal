import { defineStore } from 'pinia'
import { ethers } from 'ethers'
import config from '@/config.json'
import { useAuthStore } from '@/stores/auth'

export const useWalletStore = defineStore('wallet', {
	state: () => ({
		address: null,
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
		setAccount(address) {
			this.address = address
			this.isConnected = !!address
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
				this.selectedNetworkKey = key
				return true
			} catch (err) {
				if (err && err.code === 4902) {
					try {
						const rpcUrls = Array.isArray(net.rpcUrls) ? net.rpcUrls.filter(Boolean) : []
						const blockExplorerUrlsRaw = Array.isArray(net.blockExplorerUrls) ? net.blockExplorerUrls.filter(Boolean) : []
						const addParams = {
							chainId: hexId,
							chainName: net.chainName,
							nativeCurrency: net.nativeCurrency,
							rpcUrls
						}
						if (blockExplorerUrlsRaw.length) {
							addParams.blockExplorerUrls = blockExplorerUrlsRaw
						}
						await provider.request({
							method: 'wallet_addEthereumChain',
							params: [addParams]
						})
						await provider.request({
							method: 'wallet_switchEthereumChain',
							params: [{ chainId: hexId }]
						})
						this.selectedNetworkKey = key
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
		},

		async refreshAccountAndBalance() {
			const auth = useAuthStore()
			const provider = window.ethereum
			if (!provider) return { address: null, changed: false }

			const accounts = await provider.request({ method: 'eth_accounts' })
			let address = accounts && accounts.length ? accounts[0] : null
			if (address) {
				try {
					address = ethers.getAddress(address)
				} catch {
					address = null
				}
			}

			const prevAddress = this.address
			this.setAccount(address)

			if (address) {
				await this.fetchBalance()
			} else {
				this.setBalanceWei('0x0')
				auth.clearSession()
			}

			const sessionAddr = auth.sessionAddress || null
			const mismatchWithSession = !!(address && sessionAddr && sessionAddr.toLowerCase() !== address.toLowerCase())
			const addressChanged = !!(address && prevAddress && address !== prevAddress)

			return {
				address,
				changed: mismatchWithSession || addressChanged
			}
		},

		/**
		 * Connect to MetaMask wallet (minimal - just get address)
		 * For full authentication with Relay, use auth.authenticate()
		 */
		async connect() {
			const provider = window.ethereum
			if (!provider) {
				return { success: false, reason: 'no_provider' }
			}

			try {
				const accounts = await provider.request({ method: 'eth_requestAccounts' })
				const acct = accounts && accounts.length ? accounts[0] : null
				if (!acct) throw new Error('No account connected')

				const address = ethers.getAddress(acct)
				this.setAccount(address)
				await this.fetchBalance()

				return { success: true, address }
			} catch (e) {
				console.error('Wallet connect error:', e)
				this.setAccount(null)
				this.setBalanceWei('0x0')
				return { success: false, reason: 'connect_failed', error: e }
			}
		},

		async disconnect() {
			const auth = useAuthStore()
			const provider = window.ethereum
			if (provider && provider.request) {
				try {
					await provider.request({
						method: 'wallet_revokePermissions',
						params: [{ eth_accounts: {} }]
					})
				} catch (e) {
					console.error('Failed to revoke permissions:', e)
					return { success: false, reason: 'revoke_failed', error: e }
				}
			}
			auth.$reset()
			this.$reset()
			return { success: true }
		}
	},
	persist: true
})
