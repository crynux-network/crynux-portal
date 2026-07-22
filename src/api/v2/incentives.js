import BaseAPI from '../base-api'
import v2 from './v2'

class V2IncentivesAPI extends BaseAPI {
    getNodes() {
        return v2.get('/incentive/nodes')
    }
    getTopDelegations() {
        return v2.get('/incentive/delegations')
    }
}

const v2IncentivesAPI = new V2IncentivesAPI()

export default v2IncentivesAPI
