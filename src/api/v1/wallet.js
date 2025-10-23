import BaseAPI from '../base-api'
import v1 from './v1'

class WalletAPI extends BaseAPI {
	connectWallet(payload) {
		return v1.post('/client/connect_wallet', payload)
	}

    getRelayAccount(address) {
        return v1.get('/balance/' + address)
    }

    getWithdrawals(address, page, pageSize) {
        return v1.get(`/client/${address}/withdraw/list`, {
            params: {
                page: page,
                page_size: pageSize,
            },
        });
    }

    getDeposits(address, page, pageSize) {
        return v1.get(`/client/${address}/deposit/list`, {
            params: {
                page: page,
                page_size: pageSize,
            },
        });
    }

	withdraw(address, amount, benefitAddress, network, timestamp, signature) {
		return v1.post(`/client/${address}/withdraw`, {
			amount: amount,
			benefit_address: benefitAddress,
			network: network,
			timestamp: timestamp,
			signature: signature
		})
	}
}

export const walletAPI = new WalletAPI();
