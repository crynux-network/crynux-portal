<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  List as AList,
  Row as ARow,
  Col as ACol,
  Statistic as AStatistic,
  Tag as ATag,
  Card as ACard,
  Tooltip as ATooltip,
  message
} from 'ant-design-vue'
import { PlayCircleOutlined, PauseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons-vue'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import v2IncentivesAPI from '@/api/v2/incentives'
import { useWalletStore } from '@/stores/wallet'
import config from '@/config.json'
import NetworkTag from '@/components/network-tag.vue'

const nodes = ref([])
const loading = ref(false)

const wallet = useWalletStore()
const networkName = computed(() => {
  const key = wallet.selectedNetworkKey
  return (config.networks[key] && config.networks[key].chainName) || key
})

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

const normalizeStatus = (status) => {
  const v = status
  if (typeof v === 'number') {
    if (v === 0) return 'stopped'         // Quit
    if (v === 5) return 'paused'          // Paused
    return 'running'                      // Available, Busy, Pending*
  }
  const s = String(v || '').toLowerCase()
  if (['quit', 'stopped', 'stop'].includes(s)) return 'stopped'
  if (['paused', 'pause'].includes(s)) return 'paused'
  if (['available', 'busy', 'running', 'idle', 'pendingpause', 'pendingquit', 'pending'].includes(s)) return 'running'
  return 'running'
}

const statusText = (status) => {
  const s = normalizeStatus(status)
  if (s === 'paused') return 'Paused'
  if (s === 'stopped') return 'Stopped'
  return 'Running'
}



const formatVram = (vram) => {
  if (!vram) return '0 GB'
  const gb = Number(vram) / (1024 * 1024 * 1024)
  return gb.toFixed(0) + ' GB'
}

const fetchData = async () => {
  loading.value = true
  try {
    const [delegated, incentives] = await Promise.all([
      v2DelegatedStakingAPI.getDelegatedNodes(),
      v2IncentivesAPI.getNodes('Day')
    ])
    const incArr = (incentives && incentives.nodes) ? incentives.nodes : []
    const incMap = new Map()
    for (const item of incArr) {
      const addr = String(item && item.node_address || '').toLowerCase()
      if (addr) incMap.set(addr, item)
    }
    const list = delegated.nodes || []
    nodes.value = list.map(n => {
      const key = String(n && n.address || '').toLowerCase()
      const i = incMap.get(key) || null
      const earningsToday = i && Number.isFinite(Number(i.incentive)) ? Number(i.incentive) : 0
      const qosScore = i && Number.isFinite(Number(i.qos_score)) ? Number(i.qos_score) : null
      const probWeight = i && Number.isFinite(Number(i.prob_weight)) ? Number(i.prob_weight) : null
      return {
        ...n,
        earnings_today: earningsToday,
        qos_score: qosScore,
        prob_weight: probWeight
      }
    })
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
    <a-card :title="'Stakeable Nodes'" :bordered="false" style="opacity: 0.95">
      <a-list
        :data-source="nodes"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        row-key="address"
        :split="false"
        style="width: 100%;"
      >
        <template #renderItem="{ item }">
          <a-list-item class="node-item">
            <div class="node-item-box">
              <div class="basic-info">
                <a-tooltip placement="left">
                  <template #title>{{ statusText(item.status) }}</template>
                  <div class="status-icon">
                    <play-circle-outlined v-if="normalizeStatus(item.status) === 'running'" />
                    <pause-circle-outlined v-else-if="normalizeStatus(item.status) === 'paused'" />
                    <minus-circle-outlined v-else />
                  </div>
                </a-tooltip>
                <div class="info-left">
                  <div class="card-line">
                    <span>{{ (item.gpu_name || '').split('+')[0] }}</span>
                  </div>
                  <div class="address-line">{{ item.address }}</div>
                </div>
                <div class="info-right">
                  <NetworkTag :text="networkName" />
                  <a-tag v-if="String(item.gpu_name || '').includes('+docker')" color="blue">Docker</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Windows')" color="green">Windows</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Darwin')" color="purple">Mac</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Linux')" color="orange">Linux</a-tag>
                  <a-tag>v{{ item.version }}</a-tag>
                  <a-tag color="cyan">{{ formatVram(item.gpu_vram) }}</a-tag>
                </div>
              </div>
              <a-row :gutter="[16, 16]" align="stretch" class="node-main">
                <a-col :xs="24" :md="18" class="left-pane">
                  <div class="delegators-section">
                    <a-row :gutter="[16, 16]">
                      <a-col :xs="12" :md="6">
                        <a-statistic title="Delegators" :value="Number(item.delegators_num || 0)" />
                      </a-col>
                      <a-col :xs="12" :md="6">
                        <a-statistic title="Operator Staking" :value="formatBigInt18(item.operator_staking)" />
                      </a-col>
                      <a-col :xs="12" :md="6">
                        <a-statistic title="Delegator Staking" :value="formatBigInt18(item.delegator_staking)" />
                      </a-col>
                      <a-col :xs="12" :md="6">
                        <a-statistic title="Delegator Share" :value="Number(item.delegator_share || 0)" :precision="2" suffix="%" />
                      </a-col>
                    </a-row>
                  </div>
                  <div class="scores-section">
                    <a-row :gutter="[16, 16]">
                      <a-col :xs="8">
                        <a-statistic title="Staking Score" :value="Number(item.staking_score || 0)" :precision="2" />
                      </a-col>
                      <a-col :xs="8">
                        <a-statistic title="QoS Score" :value="item.qos_score != null ? item.qos_score * 100 : 0" :precision="2" suffix="%" />
                      </a-col>
                      <a-col :xs="8">
                        <a-statistic title="Prob Weight" :value="item.prob_weight != null ? item.prob_weight * 100 : 0" :precision="2" suffix="%" />
                      </a-col>
                    </a-row>
                  </div>
                </a-col>
                <a-col :xs="24" :md="6" class="earnings-pane">
                  <div class="earnings-box">
                    <a-statistic title="Earnings Today" :value="item.earnings_today" :precision="2" suffix="CNX" :value-style="{ fontSize: '28px', fontWeight: 700 }" />
                  </div>
                </a-col>
              </a-row>
            </div>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<style scoped>
.stakeable-nodes-container {
  padding: 0;
  margin-top: 20px;
}
.node-item {
  padding: 0;
  margin-bottom: 36px;
  width: 100%;
}
.node-item:last-child {
  margin-bottom: 0;
}
.node-item-box {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 16px;
  background: #ffffff;
  width: 100%;
}
.basic-info {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 10px 16px;
  margin: -16px -16px 12px;
  border-radius: 12px 12px 0 0;
  background: #d6ecff;
}
.status-icon {
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 8px;
  color: rgba(0, 0, 0, 0.45);
}
.basic-info .info-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.basic-info .card-line {
  font-weight: 700;
  font-size: 16px;
}
.basic-info .address-line {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
  word-break: break-all;
}
.basic-info .info-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.node-main {
  margin-top: 12px;
}
.left-pane {
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  padding-right: 16px;
}
.earnings-pane {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 16px;
}
.earnings-box {
  width: 100%;
  background: rgba(24, 144, 255, 0.06);
  border: 1px solid rgba(24, 144, 255, 0.15);
  border-radius: 10px;
  padding: 16px;
}
.delegators-section {
  margin-bottom: 12px;
}
.scores-section {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 12px;
}
</style>
