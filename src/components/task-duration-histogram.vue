<template>
    <div style="height:40px">
        <div style="float: left">
            <a-segmented v-model:value="periodSelected" :options="periodOptions" size="small"/>
        </div>
        <div style="float: right">
            <a-segmented v-model:value="taskTypeSelected" :options="taskTypeOptions" size="small" />
        </div>
    </div>
    <bar :data="chartData" :options="chartOptions" />
</template>

<script setup>
import {ref, onMounted, reactive, watch} from 'vue';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs';
import statsAPI from "@/api/v1/stats";

const periodOptions = reactive(['Hour', "Day", "Week"]);
const periodSelected = ref(periodOptions[0]);

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
      beginAtZero: true
    }
  }
};

watch([periodSelected, taskTypeSelected], () => {
    fetchData()
});

const fetchData = async () => {

  try {
    const data = await statsAPI.getTaskDuration(taskTypeSelected.value, periodSelected.value);

    const labels = data.execution_times;
    const quantities = data.task_count;
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
  }
};

onMounted(() => {
  fetchData();
});
</script>
