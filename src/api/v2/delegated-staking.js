import BaseAPI from '../base-api'
import v2 from './v2'

class V2DelegatedStakingAPI extends BaseAPI {
    getDelegatedNodes(page = 1, pageSize = 30) {
        return v2.get(`/delegated_staking/nodes?page=${page}&page_size=${pageSize}`)
    }

    getNodeDetails(address) {
        return v2.get(`/delegated_staking/nodes/${address}`)
    }

    getNodeDelegations(nodeAddress, network, page = 1, pageSize = 10) {
        return v2.get(`/delegated_staking/nodes/${nodeAddress}/delegations?network=${network}&page=${page}&page_size=${pageSize}`)
    }
}

const v2DelegatedStakingAPI = new V2DelegatedStakingAPI()

export default v2DelegatedStakingAPI
