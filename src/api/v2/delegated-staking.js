import BaseAPI from '../base-api'
import v2 from './v2'

class V2DelegatedStakingAPI extends BaseAPI {
    getDelegatedNodes() {
        return v2.get('/nodes/delegated')
    }

    getNodeDetails(address) {
        return v2.get(`/node/${address}`)
    }

    getNodeDelegations(nodeAddress, network, page = 1, pageSize = 10) {
        return v2.get(`/node/${nodeAddress}/delegations?network=${network}&page=${page}&page_size=${pageSize}`)
    }
}

const v2DelegatedStakingAPI = new V2DelegatedStakingAPI()

export default v2DelegatedStakingAPI
