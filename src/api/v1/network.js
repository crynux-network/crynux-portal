import BaseAPI from '../base-api'
import v1 from './v1'

class NetworkAPI extends BaseAPI {
    getAllNodesNumber() {
        return v1.get('/network/nodes/number')
    }

    getAllNodesData(start, total) {
        return v1.get('/network/nodes/data?start=' + start + '&total=' + total)
    }

    getAllTasksNumber() {
        return v1.get('/network/tasks/number')
    }
}

const networkAPI = new NetworkAPI()

export default networkAPI
