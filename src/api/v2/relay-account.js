import BaseAPI from '../base-api'
import v2 from './v2'

class V2RelayAccountAPI extends BaseAPI {
  getLockedVesting(address) {
    return v2.get(`/relay_account/${address}/vesting/locked`)
  }

  getVestings(address, page = 1, pageSize = 20) {
    return v2.get(`/relay_account/${address}/vesting/list`, {
      params: {
        page,
        page_size: pageSize,
      },
    })
  }
}

const v2RelayAccountAPI = new V2RelayAccountAPI()

export default v2RelayAccountAPI
