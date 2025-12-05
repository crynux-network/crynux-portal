import BaseAPI from '../base-api'
import v1 from './v1'

class NetworkAPI extends BaseAPI {
    getNetworkInfo() {
        return v1.get('/network')
    }

    getAllNodesNumber() {
        return v1.get('/network/nodes/number')
    }

    getAllNodesData(page, pageSize) {
        return v1.get('/network/nodes/data?page=' + page + '&page_size=' + pageSize)
    }

    getAllTasksNumber() {
        return v1.get('/network/tasks/number')
    }
}

const networkAPI = new NetworkAPI()

export default networkAPI
