import BaseAPI from '../base-api'
import v2 from './v2'

class V2NetworkAPI extends BaseAPI {
    getAllNodesData(start, total) {
        return v2.get('/network/nodes/data?start=' + start + '&total=' + total)
    }
}

const v2NetworkAPI = new V2NetworkAPI()

export default v2NetworkAPI
