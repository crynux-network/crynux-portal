import BaseAPI from '../base-api'
import v1 from './v1'

class IncentivesAPI extends BaseAPI {
    getNodes(period) {
        return v1.get('/incentive/nodes?period=' + period)
    }
    getIncentives(period) {
        return v1.get('/stats/line_chart/incentive?period=' + period)
    }
    getIncentivesTotal() {
        return v1.get('/incentive/total')
    }
    getNodeIncentives(address, page, pageSize) {
        return v1.get('/incentive/node/' + address + '?page=' + page + '&page_size=' + pageSize)
    }
}

const incentivesAPI = new IncentivesAPI()

export default incentivesAPI
