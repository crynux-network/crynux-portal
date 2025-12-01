<script setup>
import { ref, onMounted } from 'vue'
import {
  TypographyTitle as ATypographyTitle,
  Table as ATable,
  Tag as ATag,
  Card as ACard,
  message
} from 'ant-design-vue'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'

const nodes = ref([])
const loading = ref(false)

const columns = [
  {
    title: 'Node Address',
    dataIndex: 'address',
    key: 'address',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
  },
  {
    title: 'GPU',
    key: 'gpu',
  },
  {
    title: 'Version',
    dataIndex: 'version',
    key: 'version',
  },
  {
    title: 'Staking Score',
    dataIndex: 'staking_score',
    key: 'staking_score',
    sorter: (a, b) => a.staking_score - b.staking_score,
  },
  {
    title: 'Operator Staking',
    dataIndex: 'operator_staking',
    key: 'operator_staking',
    sorter: (a, b) => {
        const valA = (typeof a.operator_staking === 'bigint') ? a.operator_staking : BigInt(a.operator_staking || 0)
        const valB = (typeof b.operator_staking === 'bigint') ? b.operator_staking : BigInt(b.operator_staking || 0)
        if (valA < valB) return -1
        if (valA > valB) return 1
        return 0
    }
  },
  {
    title: 'Delegator Staking',
    dataIndex: 'delegator_staking',
    key: 'delegator_staking',
    sorter: (a, b) => {
        const valA = (typeof a.delegator_staking === 'bigint') ? a.delegator_staking : BigInt(a.delegator_staking || 0)
        const valB = (typeof b.delegator_staking === 'bigint') ? b.delegator_staking : BigInt(b.delegator_staking || 0)
        if (valA < valB) return -1
        if (valA > valB) return 1
        return 0
    }
  },
  {
    title: 'Delegator Share',
    dataIndex: 'delegator_share',
    key: 'delegator_share',
    sorter: (a, b) => a.delegator_share - b.delegator_share,
  },
  {
    title: 'Delegators',
    dataIndex: 'delegators_num',
    key: 'delegators_num',
    sorter: (a, b) => a.delegators_num - b.delegators_num,
  },
]

const formatBigInt18 = (value) => {
    let bn = 0n
    try {
        if (typeof value === 'bigint') bn = value
        else if (typeof value === 'string') bn = BigInt(value)
        else if (typeof value === 'number') bn = BigInt(Math.floor(Math.max(0, value)))
    } catch { bn = 0n }
    const d = 18n
    const base = 10n ** d
    const integer = bn / base
    const target = 2n
    let fraction = 0n
    if (d >= target) {
        const scaleDown = 10n ** (d - target)
        fraction = (bn % base) / scaleDown
    } else {
        const scaleUp = 10n ** (target - d)
        fraction = (bn % base) * scaleUp
    }
    const intStrRaw = integer.toString()
    const intStr = intStrRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const fracStr = fraction.toString().padStart(Number(target), '0')
    return `${intStr}.${fracStr}`
}

const truncateAddress = (addr) => {
  if (!addr) return ''
  const s = String(addr)
  if (s.length <= 12) return s
  return s.slice(0, 6) + '...' + s.slice(-4)
}

const formatVram = (vram) => {
  if (!vram) return '0 GB'
  const gb = Number(vram) / (1024 * 1024 * 1024)
  return gb.toFixed(0) + ' GB'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await v2DelegatedStakingAPI.getDelegatedNodes()
    nodes.value = res || []
  } catch (e) {
    message.error('Failed to load nodes: ' + e.message)
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="stakeable-nodes-container">
    <a-typography-title :level="2" style="color: white; margin-bottom: 24px;">Stakeable Nodes</a-typography-title>

    <a-card :bordered="false" style="opacity: 0.9">
      <a-table
        :columns="columns"
        :data-source="nodes"
        :loading="loading"
        row-key="address"
        :pagination="{ pageSize: 20 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'address'">
            <span :title="record.address">{{ truncateAddress(record.address) }}</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag color="green" v-if="record.status === 'running'">Running</a-tag>
            <a-tag color="blue" v-else-if="record.status === 'idle'">Idle</a-tag>
            <a-tag color="volcano" v-else-if="record.status === 'stopped'">Stopped</a-tag>
            <span v-else>{{ record.status }}</span>
          </template>

          <template v-else-if="column.key === 'gpu'">
            <span>{{ record.gpu_name }} ({{ formatVram(record.gpu_vram) }})</span>
          </template>

          <template v-else-if="column.key === 'staking_score'">
            <span>{{ record.staking_score?.toFixed(2) }}</span>
          </template>

          <template v-else-if="column.key === 'operator_staking'">
            <span>{{ formatBigInt18(record.operator_staking) }} CNX</span>
          </template>

          <template v-else-if="column.key === 'delegator_staking'">
            <span>{{ formatBigInt18(record.delegator_staking) }} CNX</span>
          </template>

          <template v-else-if="column.key === 'delegator_share'">
            <span>{{ record.delegator_share }}%</span>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.stakeable-nodes-container {
  padding: 50px;
}
</style>
