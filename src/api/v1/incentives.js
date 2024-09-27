import BaseAPI from '../base-api'
import v1 from './v1'

class IncentivesAPI extends BaseAPI {
    getNodes(period) {
        return v1.get('/incentive/nodes?period=' + period)
    }
    getIncentivesToday() {
        return v1.get('/incentive/today')
    }
    getIncentivesTotal() {
        return v1.get('/incentive/total')
    }
}

const incentivesAPI = new IncentivesAPI()

export default incentivesAPI
