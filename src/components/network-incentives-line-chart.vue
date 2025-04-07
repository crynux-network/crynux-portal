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
import incentivesAPI from "@/api/v1/incentives";
import moment from "moment";

const props = defineProps({
    network: {
        type: String,
        required: true
    }
})

const loading = ref(true);

const periodOptions = reactive(['Day', "Week", "Month"]);
const periodSelected = ref(periodOptions[0]);

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
          text: 'Incentives (CNX)'
        }

    }
    }
};

watch([periodSelected, () => props.network], async () => {
    await fetchData()
});

const fetchData = async () => {
    loading.value = true;
    try {
        const resp = await incentivesAPI.getIncentives(periodSelected.value);

        data.value = {
            labels: resp.timestamps.map((item) => {
                const date = moment.unix(item);

                if (periodSelected.value === "Day") {
                    return date.format("Do")
                } else if (periodSelected.value === "Week") {
                    return date.format("wo")
                } else {
                    return date.format("MMM")
                }
            }),
            datasets: [
                {
                    label: 'Incentives',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    data: resp.incentives
                }
            ]
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
