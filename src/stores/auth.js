import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
	state: () => ({
		sessionToken: null,
		sessionExpiresAt: 0,
		sessionAddress: null
	}),
	getters: {
		isAuthenticated(state) {
			return !!state.sessionToken && Number(state.sessionExpiresAt) > Math.floor(Date.now() / 1000)
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
		}
	},
	persist: true
})
