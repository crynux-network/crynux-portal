import BaseAPI from '../base-api'
import v2 from './v2'

class V2NetworkAPI extends BaseAPI {
    getAllNodesData(page, pageSize) {
        return v2.get('/network/nodes/data?page=' + page + '&page_size=' + pageSize)
    }
}

const v2NetworkAPI = new V2NetworkAPI()

export default v2NetworkAPI
