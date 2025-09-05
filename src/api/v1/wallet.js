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
}

export const walletAPI = new WalletAPI();
