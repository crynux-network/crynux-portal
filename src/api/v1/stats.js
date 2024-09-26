import BaseAPI from '../base-api'
import v1 from './v1'

class StatsAPI extends BaseAPI {
    getTaskDuration(taskType, period) {
        return v1.get('/stats/histogram/task_execution_time?task_type=' + taskType + '&period=' + period)
    }

    getTaskNumber(taskType, period) {
        return v1.get('/stats/line_chart/task_count?task_type=' + taskType + '&period=' + period)
    }
}

const statsAPI = new StatsAPI()

export default statsAPI
