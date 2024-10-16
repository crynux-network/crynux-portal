<template>
    <div style="height:40px">
        <div style="float: left">
            <a-segmented v-model:value="periodSelected" :options="periodOptions" size="small"/>
        </div>
    </div>
    <div class="loading" v-if="loading">
        <loading-outlined />
    </div>
  <Line :data="data" :options="options" />
</template>
<style scoped>
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
import statsAPI from "@/api/v1/stats";
import moment from "moment";

const loading = ref(true);

const periodOptions = reactive(['Hour', "Day", "Week"]);
const periodSelected = ref(periodOptions[0]);

const taskTypeOptions = reactive(['All', 'Image', 'Text'])
const taskTypeSelected = ref(taskTypeOptions[0]);

const data = ref({
    labels: [],
    datasets: [
    {
      label: 'Task Count',
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
          text: 'No.Tasks'
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
    const resp = await statsAPI.getTaskNumber(taskTypeSelected.value, periodSelected.value);

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
      label: 'Task Count',
      backgroundColor: 'rgba(54, 162, 235, 0.5)',
      data: resp.counts
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
