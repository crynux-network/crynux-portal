import BaseAPI from '../base-api'
import v2 from './v2'

class V2DelegatedStakingAPI extends BaseAPI {
    getDelegatedNodes() {
        return v2.get('/nodes/delegated')
    }
}

const v2DelegatedStakingAPI = new V2DelegatedStakingAPI()

export default v2DelegatedStakingAPI
