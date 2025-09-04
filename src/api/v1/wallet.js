import BaseAPI from '../base-api'
import v1 from './v1'

class WalletAPI extends BaseAPI {
	connectWallet(payload) {
		return v1.post('/client/connect_wallet', payload)
	}

    getRelayAccount(address) {
        return v1.get('/balance/' + address)
    }

    async getTxs(address, page, pageSize) {
        return await this.get("/wallet/" + address + "/txs", {
            page: page,
            page_size: pageSize
        });
    }

    async getWithdrawals(address, page, pageSize) {
        return await this.get(`/client/${address}/withdraw/list`, {
            page: page,
            page_size: pageSize,
        });
    }
}

export const walletAPI = new WalletAPI();
