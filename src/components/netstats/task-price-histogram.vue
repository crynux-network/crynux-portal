<template>
    <div style="height:40px">
        <div style="float: left">
            <a-segmented v-model:value="taskTypeSelected" :options="taskTypeOptions" size="small" />
        </div>
    </div>
    <div class="loading" v-if="loading">
        <loading-outlined />
    </div>
    <bar :data="chartData" :options="chartOptions" />
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
import {ref, onMounted, reactive, watch} from 'vue';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs';
import statsAPI from "@/api/v1/stats";
import { LoadingOutlined } from "@ant-design/icons-vue";

const loading = ref(true);

const taskTypeOptions = reactive(['All', 'Image', 'Text'])
const taskTypeSelected = ref(taskTypeOptions[0]);

const chartData = ref({
    labels: [],
    datasets: []
});

const chartOptions = {
  responsive: true,
  scales: {
    y: {
      beginAtZero: true,
        title: {
          display: true,
          text: 'No.Tasks'
        }

    },
      x: {
        title: {
            display: true,
            text: 'CNX'
        }
      }
  },
    plugins: {
      legend: {
          display: false
      }
    }
};

watch(taskTypeSelected, async () => {
    await fetchData()
});

const fetchData = async () => {

    loading.value = true;
  try {
    const data = await statsAPI.getTaskPrice(taskTypeSelected.value);

    const labels = data.task_fees;
    const quantities = data.task_counts;
    chartData.value = {
      labels,
      datasets: [
        {
          label: 'No. Tasks',
          data: quantities,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        }
      ]
    };

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
