import BaseAPI from '../base-api'
import v2 from './v2'

class V2DelegatedStakingAPI extends BaseAPI {
    getDelegatedNodes(options = {}) {
        const {
            page = 1,
            pageSize = 30,
            status = [],
            gpuVram = [],
            gpuName = [],
            version = [],
            sortBy
        } = options
        const params = new URLSearchParams()
        params.append('page', page)
        params.append('page_size', pageSize)
        if (sortBy) {
            params.append('sort_by', sortBy)
        }
        status.forEach((value) => params.append('status', value))
        gpuVram.forEach((value) => params.append('gpu_vram', value))
        gpuName.forEach((value) => params.append('gpu_name', value))
        version.forEach((value) => params.append('version', value))
        return v2.get(`/delegated_staking/nodes?${params.toString()}`)
    }

    getDelegatedNodeFilterOptions() {
        return v2.get('/delegated_staking/nodes/filter_options')
    }

    getNodeDetails(address) {
        return v2.get(`/delegated_staking/nodes/${address}`)
    }

    getNodeDelegations(nodeAddress, network, page = 1, pageSize = 10) {
        return v2.get(`/delegated_staking/nodes/${nodeAddress}/delegations?network=${network}&page=${page}&page_size=${pageSize}`)
    }

    getNodeEmissionChart(nodeAddress, weeks = 24) {
        return v2.get(`/delegated_staking/nodes/${nodeAddress}/emission/chart`, {
            params: {
                weeks
            }
        })
    }
}

const v2DelegatedStakingAPI = new V2DelegatedStakingAPI()

export default v2DelegatedStakingAPI
