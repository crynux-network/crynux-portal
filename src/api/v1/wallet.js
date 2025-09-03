import BaseAPI from '../base-api'

class WalletAPI extends BaseAPI {
	connectWallet(payload) {
		return new Promise((resolve) => {
			const now = Math.floor(Date.now() / 1000)
			const tokenSuffix = payload && payload.address ? String(payload.address).slice(-6) : 'key'
			resolve({ token: `fake-session-key-${tokenSuffix}`, expires_at: now + 3600 })
		})
	}
}

const walletAPI = new WalletAPI()

export default walletAPI
