<template>
    <div class="chart-toolbar">
        <a-segmented v-model:value="periodSelected" :options="periodOptions" size="small"/>
        <a-segmented v-model:value="taskTypeSelected" :options="taskTypeOptions" size="small" />
    </div>
    <div class="loading" v-if="loading">
        <loading-outlined />
    </div>
  <Line :data="data" :options="options" />
</template>
<style scoped>
.chart-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
}
.loading {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    height: 100%;
    text-align: center;
    font-size: 40px;
    background-color: white;
    opacity: 0.3;
    box-sizing: border-box;
    padding-top: 120px;
}
</style>
<script setup>
import { Line } from 'vue-chartjs'
import { LoadingOutlined } from "@ant-design/icons-vue";
import {onMounted, reactive, ref, watch} from "vue";
import statsAPI, { TASK_TYPE_OPTIONS } from "@/api/v1/stats";
import moment from "moment";

const loading = ref(true);

const periodOptions = reactive(['Hour', "Day", "Week"]);
const periodSelected = ref(periodOptions[0]);

const taskTypeOptions = reactive([...TASK_TYPE_OPTIONS])
const taskTypeSelected = ref(taskTypeOptions[0]);

const data = ref({
    labels: [],
    datasets: [
    {
      label: 'Success Rate',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      data: []
    }
  ]
});

const options = {
    responsive: true,
    plugins: {
      legend: {
          display: false
      }
    },
    scales: {
        y: {
          beginAtZero: true,
            title: {
              display: true,
              text: 'Success Rate'
            },
            ticks: {
              callback: (value, index, ticks) => {
                  return Math.ceil(value * 100) + '%'
              }
            }
        }
    }
};

watch([periodSelected, taskTypeSelected], async () => {
    await fetchData()
});

const fetchData = async () => {

    loading.value = true;
  try {
    const resp = await statsAPI.getTaskSuccessRate(taskTypeSelected.value, periodSelected.value);

    data.value = {
        labels: resp.timestamps.map((item) => {
            const date = moment.unix(item);

            if (periodSelected.value === "Hour") {
                return date.format("HH:mm")
            } else if (periodSelected.value === "Day") {
                return date.format("DD MMM")
            } else {
                return date.format("wo")
            }
        }),
    datasets: [
    {
      label: 'Success Rate',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      data: resp.success_rate
    }]
    }

  } catch (error) {
    console.error("Error fetching data: ", error);
  } finally {
      loading.value = false;
  }
};

onMounted(async () => {
  await fetchData();
});
</script>
