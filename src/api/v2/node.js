import BaseAPI from '../base-api'
import v2 from './v2'

class V2NodeAPI extends BaseAPI {
  getNodeDetails(address) {
    return v2.get(`/node/${address}`)
  }

  getQosTracing(address) {
    return v2.get(`/node/${address}/qos/tracing`)
  }
}

const v2NodeAPI = new V2NodeAPI()

export default v2NodeAPI
