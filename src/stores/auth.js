import { defineStore } from 'pinia'
import { ethers } from 'ethers'
import { useWalletStore } from '@/stores/wallet'
import { walletAPI } from '@/api/v1/wallet'

export const useAuthStore = defineStore('auth', {
	state: () => ({
		sessionToken: null,
		sessionExpiresAt: 0,
		sessionAddress: null,
		_isAuthenticating: false
	}),
	getters: {
		isAuthenticated(state) {
			return !!state.sessionToken && Number(state.sessionExpiresAt) > Math.floor(Date.now() / 1000)
		},
		isAuthenticating(state) {
			return state._isAuthenticating
		}
	},
	actions: {
		setSession(token, expiresAt, address) {
			this.sessionToken = token
			this.sessionExpiresAt = Number(expiresAt || 0)
			if (address) this.sessionAddress = address
		},
		clearSession() {
			this.sessionToken = null
			this.sessionExpiresAt = 0
			this.sessionAddress = null
		},

		/**
		 * Full authentication flow:
		 * 1. Connect wallet (get address from MetaMask)
		 * 2. Sign message with wallet
		 * 3. Send signature to Relay API to get auth token
		 */
		async authenticate() {
			if (this._isAuthenticating) return { success: false, reason: 'already_authenticating' }

			const wallet = useWalletStore()
			const provider = window.ethereum
			if (!provider) {
				return { success: false, reason: 'no_provider' }
			}

			this._isAuthenticating = true

			try {
				// Step 1: Connect wallet
				const connectResult = await wallet.connect()
				if (!connectResult.success) {
					return connectResult
				}
				const address = connectResult.address

				// Step 2: Sign message
				const timestamp = Math.floor(Date.now() / 1000)
				const action = 'Connect Wallet'
				const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${address}\nTimestamp: ${timestamp}`

				const signature = await provider.request({
					method: 'personal_sign',
					params: [messageToSign, address]
				})

				// Step 3: Exchange signature for auth token
				const resp = await walletAPI.connectWallet({ address, signature, timestamp })
				this.setSession(resp.token, resp.expires_at, address)

				// Step 4: Ensure network and refresh balance
				await wallet.ensureNetworkOnWallet(wallet.selectedNetworkKey)
				await wallet.refreshAccountAndBalance()

				return { success: true, address }
			} catch (e) {
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
				this.clearSession()
				return { success: false, reason: 'auth_failed', error: e }
			} finally {
				this._isAuthenticating = false
			}
		}
	},
	persist: true
})
