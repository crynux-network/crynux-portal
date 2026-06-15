import axios from 'axios'
import ApiError from './api-error'
import config from '@/config.json'
import BaseAPI from './base-api'

class CnxAPI extends BaseAPI {
  constructor(baseUrl) {
    super()

    if (baseUrl === '') {
      baseUrl = window.location.protocol + '//' + window.location.host + '/manager'
    }

    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      responseType: 'text',
      transformResponse: [(data) => data]
    })
  }

  async getCirculatingSupply() {
    try {
      const response = await this.httpClient.get('/cnx/circulating-supply')
      if (response.status !== 200) {
        throw new ApiError(ApiError.Type.Unknown)
      }
      return String(response.data || '').trim()
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      if (error.response && error.response.status === 500) {
        throw new ApiError(ApiError.Type.Server, error.response.data)
      }
      throw new ApiError(ApiError.Type.Unknown)
    }
  }
}

const cnxAPI = new CnxAPI(config.relay_url)

export default cnxAPI
