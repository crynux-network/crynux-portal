import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
	state: () => ({
		sessionToken: null,
		sessionExpiresAt: 0
	}),
	getters: {
		isAuthenticated(state) {
			return !!state.sessionToken && Number(state.sessionExpiresAt) > Math.floor(Date.now() / 1000)
		}
	},
	actions: {
		setSession(token, expiresAt) {
			this.sessionToken = token
			this.sessionExpiresAt = Number(expiresAt || 0)
		},
		clearSession() {
			this.sessionToken = null
			this.sessionExpiresAt = 0
		}
	},
	persist: true
})
