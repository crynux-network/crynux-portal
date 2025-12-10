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

	getDelegation(userAddress, nodeAddress, network) {
		return v1.get(`/delegator/${userAddress}/delegation`, {
			params: {
				node_address: nodeAddress,
				network: network
			}
		})
	}

	getIncomeStats(address) {
		return v1.get(`/client/${address}/income/stats`)
	}

	getDelegatorStats(userAddress) {
		return v1.get(`/delegator/${userAddress}`)
	}

	getDelegatorDelegations(userAddress, page = 1, pageSize = 20) {
		return v1.get(`/delegator/${userAddress}/delegations`, {
			params: {
				page: page,
				page_size: pageSize
			}
		})
	}

	getDelegatorEarningsChart(userAddress) {
		return v1.get(`/stats/line_chart/delegator/${userAddress}/earnings`)
	}

	getDelegationIncomeChart(userAddress, nodeAddress, network) {
		return v1.get(`/stats/line_chart/delegation/${userAddress}/${nodeAddress}/earnings`, {
			params: { network }
		})
	}
}

export const walletAPI = new WalletAPI();
