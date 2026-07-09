<script setup>
import { ref, onMounted, onUnmounted, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { List as AList, Row as ARow, Col as ACol, Tag as ATag, Card as ACard, Tooltip as ATooltip, message } from 'ant-design-vue'
import { PlayCircleOutlined, PlayCircleFilled, PauseCircleOutlined, MinusCircleOutlined, FunnelPlotOutlined, ThunderboltOutlined, DollarOutlined, InfoCircleFilled, QuestionCircleOutlined } from '@ant-design/icons-vue'
import v2DelegatedStakingAPI from '@/api/v2/delegated-staking'
import { formatBigInt18Compact } from '@/services/token'
import NetworkTag from '@/components/network-tag.vue'
import { formatNetworkName as formatConfiguredNetworkName } from '@/services/network-config'

const router = useRouter()
const nodes = ref([])
const loading = ref(false)
const filterOptionsLoading = ref(false)
const nodesTotal = ref(0)
const nodesPage = ref(1)
const nodesPageSize = 30
const filterOptions = ref({
  statuses: [],
  gpu_vrams: [],
  gpu_names: [],
  versions: []
})
const selectedStatuses = ref([])
const selectedGPUVrams = ref([])
const selectedGPUNames = ref([])
const selectedVersions = ref([])
const gpuVramSearchText = ref('')
const gpuVramDropdownOpen = ref(false)
const gpuNameSearchText = ref('')
const gpuNameDropdownOpen = ref(false)
const expandedFilterKey = ref('status')
const sortBy = ref('estimated_upcoming_delegator_emission')

const sortOptions = [
  { value: 'operator_emission_4w', label: 'Operator Emission (4W)' },
  { value: 'estimated_upcoming_operator_emission', label: 'Est. Next Operator Emission' },
  { value: 'estimated_upcoming_delegator_emission', label: 'Est. Next Delegators Emission' },
  { value: 'delegation_apr_12m', label: 'Historical APR' },
  { value: 'operator_staking', label: 'Operator Staking' },
  { value: 'delegator_staking', label: 'Delegator Staking' },
  { value: 'total_staking', label: 'Total Staking' },
  { value: 'delegators_num', label: 'Delegators' },
  { value: 'prob_weight', label: 'Prob Weight' },
  { value: 'qos', label: 'QoS Score' },
  { value: 'gpu_vram', label: 'GPU VRAM' }
]

const circleIconProps = {
  viewBox: '0 0 1024 1024',
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  focusable: 'false',
  'aria-hidden': 'true'
}

const circleIconStyle = {
  display: 'inline-block',
  fontSize: '20px',
  flex: '0 0 auto'
}

const GpuVramCircleFilled = () => h(
  'svg',
  { ...circleIconProps, style: circleIconStyle },
  [
    h('path', { d: 'M512 64a448 448 0 1 0 0 896 448 448 0 0 0 0-896z' }),
    h('path', { d: 'M336 328h352c44.2 0 80 35.8 80 80v208c0 44.2-35.8 80-80 80H336c-44.2 0-80-35.8-80-80V408c0-44.2 35.8-80 80-80z', fill: '#fff' }),
    h('path', { d: 'M360 424h304v176H360V424zm48 48v40h208v-40H408zm0 80v40h136v-40H408z', fill: 'currentColor' })
  ]
)

const GpuNameCircleFilled = () => h(
  'svg',
  { ...circleIconProps, style: circleIconStyle },
  [
    h('path', { d: 'M512 64a448 448 0 1 0 0 896 448 448 0 0 0 0-896z' }),
    h('path', { d: 'M344 344h238c17 0 33.3 6.7 45.3 18.7l109 109c25 25 25 65.5 0 90.5L562.2 736.3c-25 25-65.5 25-90.5 0l-109-109A64 64 0 0 1 344 582V344z', fill: '#fff' }),
    h('path', { d: 'M448 448a48 48 0 1 0 0 96 48 48 0 0 0 0-96z', fill: 'currentColor' })
  ]
)

const filterSections = computed(() => [
  {
    key: 'status',
    title: 'Status',
    icon: PlayCircleFilled,
    selected: selectedStatuses,
    options: filterOptions.value.statuses.map((status) => ({
      value: status,
      label: statusFilterText(status)
    }))
  },
  {
    key: 'version',
    title: 'Version',
    icon: InfoCircleFilled,
    selected: selectedVersions,
    options: filterOptions.value.versions.map((version) => ({
      value: version,
      label: version
    }))
  }
])

const gpuVramSearchResults = computed(() => {
  const keyword = gpuVramSearchText.value.trim().toLowerCase()
  return filterOptions.value.gpu_vrams
    .filter((vram) => {
      if (selectedGPUVrams.value.includes(vram)) return false
      if (!keyword) return true
      const rawVram = String(vram || '').toLowerCase()
      const displayVram = formatVram(vram).toLowerCase()
      return rawVram.includes(keyword) || displayVram.includes(keyword)
    })
    .slice(0, 10)
})

const gpuNameSearchResults = computed(() => {
  const keyword = gpuNameSearchText.value.trim().toLowerCase()
  return filterOptions.value.gpu_names
    .filter((name) => {
      if (selectedGPUNames.value.includes(name)) return false
      if (!keyword) return true
      const rawName = String(name || '').toLowerCase()
      const displayName = formatGpuName(name).toLowerCase()
      return rawName.includes(keyword) || displayName.includes(keyword)
    })
    .slice(0, 10)
})

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const isFiltersStacked = computed(() => windowWidth.value < 992)
const filtersCollapsed = ref(isFiltersStacked.value)
const handleResize = () => {
  const wasStacked = isFiltersStacked.value
  const nextWidth = window.innerWidth
  windowWidth.value = nextWidth

  if (nextWidth >= 992) {
    filtersCollapsed.value = false
  } else if (!wasStacked) {
    filtersCollapsed.value = true
  }
}
const scoreSize = computed(() => {
  const w = windowWidth.value
  if (w >= 1600) return 60
  if (w >= 1200) return 56
  if (w >= 992) return 52
  if (w >= 768) return 48
  if (w >= 576) return 44
  return 40
})

function getNetworkName(networkKey) {
  return formatConfiguredNetworkName(networkKey)
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

const statusFilterText = (status) => {
  if (status === 'stopped') return 'Stopped'
  return 'Running'
}

const formatGpuName = (name) => {
  return String(name || '').split('+')[0]
}



const formatVram = (vram) => {
  const n = Number(vram)
  if (!Number.isFinite(n) || n <= 0) return '0 GB'
  return Math.round(n) + ' GB'
}

const formatIntegerWithThousands = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const intVal = Math.floor(Math.max(0, n))
  return intVal.toLocaleString('en-US')
}

const formatWholeCnxAmount = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const amount = Math.floor(Math.max(0, n))
  const toOneDecimal = (val, unit) => {
    const scaled = Math.floor((val * 10) / unit)
    const whole = Math.floor(scaled / 10)
    const frac = scaled % 10
    return frac === 0 ? `${whole}` : `${whole}.${frac}`
  }
  if (amount >= 1_000_000_000) return `${toOneDecimal(amount, 1_000_000_000)}B`
  if (amount >= 1_000_000) return `${toOneDecimal(amount, 1_000_000)}M`
  if (amount >= 1_000) return `${toOneDecimal(amount, 1_000)}K`
  return formatIntegerWithThousands(amount)
}

const formatAprPercent = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  const percent = Math.floor(Math.max(0, n) * 100)
  return `${percent.toLocaleString('en-US')}%`
}

const clampPercent = (value) => {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

const percentFromRatio = (ratio) => {
  const r = Number.isFinite(Number(ratio)) ? Number(ratio) : 0
  return clampPercent(r * 100)
}



const fetchData = async (page = 1) => {
  loading.value = true
  try {
    const delegated = await v2DelegatedStakingAPI.getDelegatedNodes({
      page,
      pageSize: nodesPageSize,
      status: selectedStatuses.value,
      gpuVram: selectedGPUVrams.value,
      gpuName: selectedGPUNames.value,
      version: selectedVersions.value,
      sortBy: sortBy.value
    })
    nodes.value = (delegated && delegated.nodes) ? delegated.nodes : []
    nodesTotal.value = delegated?.total || 0
    nodesPage.value = page
  } catch (e) {
    message.error('Failed to load nodes: ' + e.message)
    console.error(e)
  } finally {
    loading.value = false
  }
}

const fetchFilterOptions = async () => {
  filterOptionsLoading.value = true
  try {
    const options = await v2DelegatedStakingAPI.getDelegatedNodeFilterOptions()
    filterOptions.value = {
      statuses: options?.statuses || [],
      gpu_vrams: options?.gpu_vrams || [],
      gpu_names: options?.gpu_names || [],
      versions: options?.versions || []
    }
  } catch (e) {
    message.error('Failed to load filter options: ' + e.message)
    console.error(e)
  } finally {
    filterOptionsLoading.value = false
  }
}

const onNodesPageChange = (page) => {
  fetchData(page)
}

const onFilterChange = () => {
  fetchData(1)
}

const isAllFilterSelected = (selectedValues) => selectedValues.length === 0

const isFilterOptionSelected = (selectedValues, value) => selectedValues.includes(value)

const selectedFilterValues = (key) => {
  if (key === 'status') return selectedStatuses.value
  if (key === 'gpu_vram') return selectedGPUVrams.value
  if (key === 'gpu_name') return selectedGPUNames.value
  if (key === 'version') return selectedVersions.value
  return []
}

const hasActiveFilterSelection = (key) => selectedFilterValues(key).length > 0

const isFilterSectionExpanded = (key) => hasActiveFilterSelection(key) || expandedFilterKey.value === key

const toggleFilterSection = (key) => {
  if (hasActiveFilterSelection(key)) return
  expandedFilterKey.value = expandedFilterKey.value === key ? '' : key
}

const clearFilterSelection = (selected, key) => {
  if (selected.value.length === 0) return
  selected.value = []
  expandedFilterKey.value = key
  onFilterChange()
}

const toggleFilterOption = (selected, key, value, checked) => {
  if (checked) {
    if (!selected.value.includes(value)) {
      selected.value = [...selected.value, value]
      onFilterChange()
    }
    return
  }

  selected.value = selected.value.filter((item) => item !== value)
  if (selected.value.length === 0) {
    expandedFilterKey.value = key
  }
  onFilterChange()
}

const clearGpuVramFilter = () => {
  if (selectedGPUVrams.value.length === 0 && gpuVramSearchText.value === '') return
  selectedGPUVrams.value = []
  gpuVramSearchText.value = ''
  gpuVramDropdownOpen.value = false
  expandedFilterKey.value = 'gpu_vram'
  onFilterChange()
}

const openGpuVramDropdown = () => {
  gpuVramDropdownOpen.value = true
}

const onGpuVramInputChange = (event) => {
  gpuVramSearchText.value = event?.target?.value || ''
  gpuVramDropdownOpen.value = true
}

const closeGpuVramDropdown = () => {
  window.setTimeout(() => {
    gpuVramDropdownOpen.value = false
  }, 120)
}

const selectGpuVram = (vram) => {
  if (!selectedGPUVrams.value.includes(vram)) {
    selectedGPUVrams.value = [...selectedGPUVrams.value, vram]
    onFilterChange()
  }
  gpuVramSearchText.value = ''
  gpuVramDropdownOpen.value = false
}

const removeGpuVram = (vram) => {
  selectedGPUVrams.value = selectedGPUVrams.value.filter((item) => item !== vram)
  if (selectedGPUVrams.value.length === 0) {
    expandedFilterKey.value = 'gpu_vram'
  }
  onFilterChange()
}

const clearGpuNameFilter = () => {
  if (selectedGPUNames.value.length === 0 && gpuNameSearchText.value === '') return
  selectedGPUNames.value = []
  gpuNameSearchText.value = ''
  gpuNameDropdownOpen.value = false
  expandedFilterKey.value = 'gpu_name'
  onFilterChange()
}

const openGpuNameDropdown = () => {
  gpuNameDropdownOpen.value = true
}

const onGpuNameInputChange = (event) => {
  gpuNameSearchText.value = event?.target?.value || ''
  gpuNameDropdownOpen.value = true
}

const closeGpuNameDropdown = () => {
  window.setTimeout(() => {
    gpuNameDropdownOpen.value = false
  }, 120)
}

const selectGpuName = (name) => {
  if (!selectedGPUNames.value.includes(name)) {
    selectedGPUNames.value = [...selectedGPUNames.value, name]
    onFilterChange()
  }
  gpuNameSearchText.value = ''
  gpuNameDropdownOpen.value = false
}

const removeGpuName = (name) => {
  selectedGPUNames.value = selectedGPUNames.value.filter((item) => item !== name)
  if (selectedGPUNames.value.length === 0) {
    expandedFilterKey.value = 'gpu_name'
  }
  onFilterChange()
}

const onSortChange = () => {
  fetchData(1)
}

const toggleFiltersCollapsed = () => {
  if (!isFiltersStacked.value) return
  filtersCollapsed.value = !filtersCollapsed.value
}

const openNodeDetails = (address) => {
  const href = router.resolve({ name: 'node-details', params: { address } }).href
  window.open(href, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  fetchFilterOptions()
  fetchData()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize)
  }
})
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', handleResize)
  }
})
</script>

<template>
  <div class="stakeable-nodes-container">
    <a-row :gutter="[16, 16]" align="top">
      <a-col class="filters-column" :xs="24" :lg="6" :xl="5">
        <a-card
          :class="['filters-card', { 'filters-card-collapsed': isFiltersStacked && filtersCollapsed }]"
          :bordered="false"
          style="opacity: 0.9"
          :loading="filterOptionsLoading"
        >
          <template #title>
            <button
              type="button"
              class="filters-card-title"
              :disabled="!isFiltersStacked"
              @click="toggleFiltersCollapsed"
            >
              <span>Filters</span>
              <span
                v-if="isFiltersStacked"
                class="filters-collapse-icon"
                :class="{ expanded: !filtersCollapsed }"
              />
            </button>
          </template>
          <div v-show="!isFiltersStacked || !filtersCollapsed">
            <template v-for="section in filterSections" :key="section.key">
              <div class="filter-section">
                <button
                  type="button"
                  class="filter-section-title"
                  :aria-expanded="isFilterSectionExpanded(section.key)"
                  @click="toggleFilterSection(section.key)"
                >
                  <span class="filter-section-title-content">
                    <component :is="section.icon" />
                    <span>{{ section.title }}</span>
                  </span>
                  <span
                    class="filter-section-caret"
                    :class="{ expanded: isFilterSectionExpanded(section.key) }"
                  />
                </button>
                <div v-show="isFilterSectionExpanded(section.key)" class="filter-option-list">
                  <a-checkbox
                    class="filter-option"
                    :checked="isAllFilterSelected(section.selected.value)"
                    @change="() => clearFilterSelection(section.selected, section.key)"
                  >
                    All
                  </a-checkbox>
                  <a-checkbox
                    v-for="option in section.options"
                    :key="option.value"
                    class="filter-option"
                    :checked="isFilterOptionSelected(section.selected.value, option.value)"
                    @change="event => toggleFilterOption(section.selected, section.key, option.value, event.target.checked)"
                  >
                    {{ option.label }}
                  </a-checkbox>
                </div>
              </div>
              <div v-if="section.key === 'status'" class="filter-section">
                <button
                  type="button"
                  class="filter-section-title"
                  :aria-expanded="isFilterSectionExpanded('gpu_vram')"
                  @click="toggleFilterSection('gpu_vram')"
                >
                  <span class="filter-section-title-content">
                    <gpu-vram-circle-filled />
                    <span>GPU VRAM</span>
                  </span>
                  <span
                    class="filter-section-caret"
                    :class="{ expanded: isFilterSectionExpanded('gpu_vram') }"
                  />
                </button>
                <div v-show="isFilterSectionExpanded('gpu_vram')" class="searchable-filter">
                  <a-checkbox
                    class="filter-option"
                    :checked="isAllFilterSelected(selectedGPUVrams)"
                    @change="clearGpuVramFilter"
                  >
                    All
                  </a-checkbox>
                  <div v-if="selectedGPUVrams.length > 0" class="selected-filter-card-list">
                    <a-checkbox
                      v-for="vram in selectedGPUVrams"
                      :key="vram"
                      class="filter-value-card selected"
                      :checked="true"
                      @change="() => removeGpuVram(vram)"
                    >
                      {{ formatVram(vram) }}
                    </a-checkbox>
                  </div>
                  <div class="filter-search-box">
                    <a-input
                      v-model:value="gpuVramSearchText"
                      allow-clear
                      placeholder="Search GPU VRAM"
                      @focus="openGpuVramDropdown"
                      @change="onGpuVramInputChange"
                      @blur="closeGpuVramDropdown"
                    />
                    <div v-if="gpuVramDropdownOpen" class="filter-dropdown">
                      <button
                        v-for="vram in gpuVramSearchResults"
                        :key="vram"
                        type="button"
                        class="filter-value-card filter-result-card"
                        @mousedown.prevent="selectGpuVram(vram)"
                      >
                        {{ formatVram(vram) }}
                      </button>
                      <div v-if="gpuVramSearchResults.length === 0" class="filter-empty">
                        No GPU VRAM found
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="section.key === 'status'" class="filter-section">
                <button
                  type="button"
                  class="filter-section-title"
                  :aria-expanded="isFilterSectionExpanded('gpu_name')"
                  @click="toggleFilterSection('gpu_name')"
                >
                  <span class="filter-section-title-content">
                    <gpu-name-circle-filled />
                    <span>GPU Name</span>
                  </span>
                  <span
                    class="filter-section-caret"
                    :class="{ expanded: isFilterSectionExpanded('gpu_name') }"
                  />
                </button>
                <div v-show="isFilterSectionExpanded('gpu_name')" class="searchable-filter">
                  <a-checkbox
                    class="filter-option"
                    :checked="isAllFilterSelected(selectedGPUNames)"
                    @change="clearGpuNameFilter"
                  >
                    All
                  </a-checkbox>
                  <div v-if="selectedGPUNames.length > 0" class="selected-filter-card-list">
                    <a-checkbox
                      v-for="name in selectedGPUNames"
                      :key="name"
                      class="filter-value-card selected"
                      :checked="true"
                      @change="() => removeGpuName(name)"
                    >
                      {{ formatGpuName(name) }}
                    </a-checkbox>
                  </div>
                  <div class="filter-search-box">
                    <a-input
                      v-model:value="gpuNameSearchText"
                      allow-clear
                      placeholder="Search GPU name"
                      @focus="openGpuNameDropdown"
                      @change="onGpuNameInputChange"
                      @blur="closeGpuNameDropdown"
                    />
                    <div v-if="gpuNameDropdownOpen" class="filter-dropdown">
                      <button
                        v-for="name in gpuNameSearchResults"
                        :key="name"
                        type="button"
                        class="filter-value-card filter-result-card"
                        @mousedown.prevent="selectGpuName(name)"
                      >
                        {{ formatGpuName(name) }}
                      </button>
                      <div v-if="gpuNameSearchResults.length === 0" class="filter-empty">
                        No GPU names found
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="18" :xl="19">
        <a-card :title="'Stakeable Nodes'" :bordered="false" style="opacity: 0.9">
          <div class="list-toolbar">
            <span class="sort-label">Sort by</span>
            <a-select v-model:value="sortBy" style="width: 240px" @change="onSortChange">
              <a-select-option v-for="option in sortOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </a-select-option>
            </a-select>
          </div>
          <a-divider />
          <a-list
            :data-source="nodes"
            :loading="loading"
            :pagination="{
              current: nodesPage,
              pageSize: nodesPageSize,
              total: nodesTotal,
              onChange: onNodesPageChange
            }"
            row-key="address"
            :split="false"
            :grid="{ gutter: 8, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 3 }"
            style="width: 100%;"
          >
            <template #renderItem="{ item }">
              <a-list-item class="node-item">
            <div
              class="node-item-box"
              role="button"
              tabindex="0"
              @click="openNodeDetails(item.address)"
              @keydown.enter="openNodeDetails(item.address)"
            >
              <div class="basic-info">
                <div class="info-title">
                  <a-tooltip placement="left">
                    <template #title>{{ statusText(item.status) }}</template>
                    <div class="status-icon" :class="normalizeStatus(item.status)">
                      <play-circle-outlined v-if="normalizeStatus(item.status) === 'running'" />
                      <pause-circle-outlined v-else-if="normalizeStatus(item.status) === 'paused'" />
                      <minus-circle-outlined v-else />
                    </div>
                  </a-tooltip>
                  <div class="title-text">
                    <div class="card-line">
                      <span>{{ (item.gpu_name || '').split('+')[0] }}</span>
                    </div>
                    <div class="address-line">{{ item.address }}</div>
                  </div>
                </div>
                <div class="info-right">
                  <NetworkTag :text="getNetworkName(item.network)" />
                  <a-tag v-if="String(item.gpu_name || '').includes('+docker')" color="blue">Docker</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Windows')" color="green">Windows</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Darwin')" color="purple">Mac</a-tag>
                  <a-tag v-else-if="String(item.gpu_name || '').includes('+Linux')" color="orange">Linux</a-tag>
                  <a-tag color="cyan">{{ formatVram(item.gpu_vram) }}</a-tag>
                </div>
              </div>
              <a-row :gutter="[16, 16]" align="stretch" class="node-main">
                <a-col :xs="24" :md="24" class="earnings-row">
                  <div class="earnings-inline-compact">
                    <div class="earnings-inline-label">Est. Next Delegators Emission</div>
                    <div class="earnings-inline-value">{{ formatWholeCnxAmount(item.estimated_upcoming_delegator_emission) }}</div>
                  </div>
                </a-col>
                <a-col :xs="24" :md="24" class="earnings-row">
                  <div class="earnings-inline-compact apr-inline-compact">
                    <div class="apr-inline-row">
                      <div class="earnings-inline-label earnings-inline-label-with-tooltip">
                        Historical APR
                        <a-tooltip title="This APR is based on historical staking data and does not represent future earnings.">
                          <question-circle-outlined class="earnings-info-icon" />
                        </a-tooltip>
                      </div>
                      <div class="earnings-inline-value">{{ formatAprPercent(item.delegation_apr_12m) }}</div>
                    </div>
                    <div class="apr-inline-row apr-inline-row-small">
                      <div class="earnings-inline-label">Est. APR for next staking</div>
                      <a-tooltip title="10K / 100K / 1M">
                        <div class="estimated-apr-values">
                          <span>{{ formatAprPercent(item.estimated_next_10k_delegation_apr) }}</span>
                          <span class="estimated-apr-separator">|</span>
                          <span>{{ formatAprPercent(item.estimated_next_100k_delegation_apr) }}</span>
                          <span class="estimated-apr-separator">|</span>
                          <span>{{ formatAprPercent(item.estimated_next_1m_delegation_apr) }}</span>
                        </div>
                      </a-tooltip>
                    </div>
                  </div>
                </a-col>
                <a-col :xs="24" :md="24" class="left-pane">
                  <div class="scores-section">
                    <a-row :gutter="[16, 16]" class="scores-grid" align="middle">
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.prob_weight * 2)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <funnel-plot-outlined />
                            <a-typography-text type="secondary">Prob Weight</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.qos_score)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <thunderbolt-outlined />
                            <a-typography-text type="secondary">QoS Score</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                      <a-col :xs="8">
                        <div class="score">
                          <a-progress
                            type="circle"
                            :percent="percentFromRatio(item.staking_score)"
                            :size="scoreSize"
                            :show-info="true"
                            :format="(p) => Math.round(p).toString()"
                            :stroke-color="'#8c8c8c'"
                            :trail-color="'#e9e9e9'"
                            :status="'normal'"
                            :title="null"
                          />
                          <div class="score-label-row">
                            <dollar-outlined />
                            <a-typography-text type="secondary">Staking Score</a-typography-text>
                          </div>
                        </div>
                      </a-col>
                    </a-row>
                  </div>
                  <div class="delegators-section">
                    <a-row :gutter="[4, 4]" class="staking-grid">
                      <a-col :xs="7" :sm="7" :md="7" :lg="6" :xl="6" :xxl="6">
                        <div class="kpi">
                          <a-tooltip placement="top" title="Delegator Share">
                            <div class="kpi-value">{{ Math.round(Number(item.delegator_share || 0)) }} %</div>
                          </a-tooltip>
                        </div>
                      </a-col>
                      <a-col :xs="10" :sm="10" :md="10" :lg="12" :xl="12" :xxl="12">
                        <div class="kpi">
                          <a-tooltip placement="top" title="Delegators Stake / Operator Stake">
                            <div class="kpi-value">
                              {{ formatBigInt18Compact(item.delegator_staking) }} / {{ formatBigInt18Compact(item.operator_staking) }}
                            </div>
                          </a-tooltip>
                        </div>
                      </a-col>
                      <a-col :xs="7" :sm="7" :md="7" :lg="6" :xl="6" :xxl="6">
                        <div class="kpi">
                          <a-tooltip placement="top" title="Delegators">
                            <div class="kpi-value">{{ formatIntegerWithThousands(item.delegators_num) }}</div>
                          </a-tooltip>
                        </div>
                      </a-col>
                    </a-row>
                  </div>
                </a-col>
              </a-row>
            </div>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
  </template>

<style scoped>
.stakeable-nodes-container {
  padding: 0;
  margin-top: 20px;
}
@media (min-width: 992px) {
  .filters-column {
    align-self: stretch;
  }
  .filters-card {
    position: sticky;
    top: 24px;
    z-index: 2;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
  }
}
.filters-card :deep(.ant-card-body) {
  padding-left: 12px;
  padding-right: 12px;
}
.filters-card-collapsed :deep(.ant-card-head) {
  border-bottom: 0;
}
.filters-card-collapsed :deep(.ant-card-body) {
  padding-top: 0;
  padding-bottom: 0;
}
.filters-card-title {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}
.filters-card-title:disabled {
  cursor: default;
}
.filters-collapse-icon {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid rgba(0, 0, 0, 0.65);
  transition: transform 0.2s ease;
}
.filters-collapse-icon.expanded {
  transform: rotate(180deg);
}
.filter-section {
  margin-bottom: 18px;
}
.filter-section:last-child {
  margin-bottom: 0;
}
.filter-section-title {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 10px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.85);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.filter-section-title-content {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-section-title :deep(.anticon) {
  color: rgba(0, 0, 0, 0.65);
  font-size: 18px;
  flex: 0 0 auto;
}
.filter-section-caret {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid rgba(0, 0, 0, 0.65);
  transition: transform 0.2s ease;
  flex: 0 0 auto;
}
.filter-section-caret.expanded {
  transform: rotate(180deg);
}
.filter-option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 16px;
}
.filter-option {
  max-width: 100%;
  margin-inline-start: 0 !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.filter-option :deep(.ant-checkbox + span) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.searchable-filter {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 16px;
}
.selected-filter-card-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-search-box {
  position: relative;
}
.filter-dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.filter-value-card {
  width: 100%;
  min-height: 36px;
  margin-inline-start: 0 !important;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  background: #ffffff;
  color: rgba(0, 0, 0, 0.85);
  text-align: left;
}
.filter-value-card.selected {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.18);
}
.filter-result-card {
  display: block;
  margin-bottom: 6px;
  cursor: pointer;
}
.filter-result-card:last-child {
  margin-bottom: 0;
}
.filter-result-card:hover {
  border-color: rgba(0, 0, 0, 0.35);
  color: rgba(0, 0, 0, 0.85);
}
.filter-empty {
  padding: 8px 10px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}
.sort-label {
  color: rgba(0, 0, 0, 0.65);
}
/* Ensure list grid spacing is truly reduced and left edge aligns with card title */
.stakeable-nodes-container :deep(.ant-list .ant-row) {
  margin-left: -4px;   /* -gutter/2 */
  margin-right: -4px;  /* -gutter/2 */
}
.stakeable-nodes-container :deep(.ant-list .ant-col) {
  padding-left: 4px;   /* gutter/2 */
  padding-right: 4px;  /* gutter/2 */
}
/* Ant List grid may render without Row/Col; fallback to adjust item paddings directly */
.stakeable-nodes-container :deep(.ant-list .ant-list-items) {
  margin-left: -4px;   /* -gutter/2 */
  margin-right: -4px;  /* -gutter/2 */
}
.stakeable-nodes-container :deep(.ant-list .ant-list-item) {
  padding-left: 4px;   /* gutter/2 */
  padding-right: 4px;  /* gutter/2 */
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
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.node-item-box:hover {
  border-color: #1890ff;
}
.basic-info {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 10px 16px;
  margin: -16px -16px 12px;
  border-radius: 12px 12px 0 0;
  background: rgba(24, 144, 255, 0.06);
  flex-wrap: wrap;
}
.status-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 8px;
  color: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  background: #fafafa;
}
.status-icon.running {
  color: #1890ff;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.basic-info .info-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.basic-info .info-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.basic-info .title-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.basic-info .card-line {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.basic-info .address-line {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.basic-info .info-right {
  margin-left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
}
/* Reduce default Tag spacing inside header */
.basic-info .info-right :deep(.ant-tag) {
  margin-right: 0;
  margin-left: 0;
}
.node-main {
  margin-top: 8px;
}
.earnings-row {
  width: 100%;
}
.earnings-inline {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 8px 12px;
}
.earnings-inline-compact {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.apr-inline-compact {
  align-items: stretch;
  flex-direction: column;
  gap: 8px;
}
.apr-inline-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.apr-inline-row-small {
  font-size: 11px;
}
.earnings-inline-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.apr-inline-row-small .earnings-inline-label {
  font-size: 11px;
}
.earnings-inline-label-with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.earnings-info-icon {
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
}
.earnings-inline-value {
  font-size: 18px;
  font-weight: 800;
  color: #1890ff;
  line-height: 1;
}
.estimated-apr-values {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: help;
}
.estimated-apr-separator {
  color: rgba(0, 0, 0, 0.25);
  font-weight: 400;
}
.earnings-inline :deep(.ant-descriptions-item-label) {
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
}
.earnings-value {
  font-size: 18px;
  font-weight: 800;
  color: #1890ff;
}
.staking-grid .ant-col:not(:first-child) .kpi {
  border-left: 1px solid rgba(0, 0, 0, 0.06);
}
.left-pane {
  border-right: 0;
  padding-right: 0;
}
.delegators-section {
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  padding: 6px;
  margin-top: 20px;
  width: 100%;
  margin-left: 0;
  margin-right: 0;
}
.scores-section {
  background: transparent;
  border-radius: 0;
  padding: 0;
  margin-top: 0;
}
.score {
  text-align: center;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score :deep(.ant-progress-text) {
  color: #8c8c8c;
}
.score-label {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.score-label-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1;
  flex-wrap: nowrap;
  overflow: hidden;
}
.score-tag {
  font-size: 12px;
}
.score-label-row .anticon {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
}
.score-label-row .anticon svg {
  display: block;
}
.score-label-row :deep(.ant-typography) {
  font-size: 12px;
  line-height: 1;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score-label-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.score-number {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.65);
}
.kpi {
  text-align: center;
  padding: 6px 0;
}
.kpi-value {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
.kpi-label {
  margin-top: 6px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 768px) {
  .basic-info {
    flex-direction: column;
  }
  .status-icon {
    width: 30px;
    height: 30px;
    font-size: 18px;
    margin-right: 6px;
  }
  .basic-info .info-right {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
    padding-left: 0;
  }
  .status-icon {
    width: 28px;
    font-size: 24px;
    margin-right: 6px;
  }
  .left-pane {
    border-right: 0;
    padding-right: 0;
  }
  .delegators-section {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
  .earnings-pane {
    display: none !important;
  }
  /* Make the card full-bleed on mobile while avoiding horizontal scrollbars */
  .stakeable-nodes-container {
    margin-top: 0;
    padding: 0;
    overflow-x: hidden;
    margin-left: -16px;   /* counter parent horizontal padding */
    margin-right: -16px;  /* counter parent horizontal padding */
    width: calc(100% + 32px);
    box-sizing: border-box;
  }
  .stakeable-nodes-container :deep(.ant-card) {
    border-radius: 8px; /* keep rounded corners */
    border: 0;
    margin: 0;
  }
  .stakeable-nodes-container :deep(.ant-card-head) {
    padding: 0 12px;
    border-bottom: 0;
  }
  .stakeable-nodes-container :deep(.ant-card-body) {
    padding: 0; /* remove body padding; item gutters will provide spacing */
  }
  /* Prevent nested vertical scrollbars by letting content grow */
  .stakeable-nodes-container :deep(.ant-card),
  .stakeable-nodes-container :deep(.ant-card-body) {
    height: auto !important;
    overflow: hidden !important; /* avoid inner scrollbars */
  }
  .stakeable-nodes-container :deep(.ant-list) {
    height: auto !important;
    overflow: visible !important;
  }
  /* Remove list/grid side paddings to gain more width */
  .stakeable-nodes-container :deep(.ant-list .ant-row),
  .stakeable-nodes-container :deep(.ant-list .ant-list-items) {
    margin-left: 0;
    margin-right: 0;
  }
  .stakeable-nodes-container :deep(.ant-list .ant-col),
  .stakeable-nodes-container :deep(.ant-list .ant-list-item) {
    padding-left: 12px;  /* slightly larger side gutters per item */
    padding-right: 12px; /* slightly larger side gutters per item */
  }
  /* Add space between pager and card bottom on mobile */
  .stakeable-nodes-container :deep(.ant-list .ant-list-pagination),
  .stakeable-nodes-container :deep(.ant-list .ant-pagination) {
    margin-bottom: 12px;
  }
  /* Slightly increase vertical spacing between items on mobile */
  .node-item { margin-bottom: 44px; }
}
/* Responsive typography scaling */
@media (max-width: 1200px) {
  .kpi-value { font-size: 16px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 36px; }
  .earnings-value { font-size: 16px; }
  .score :deep(.ant-progress-text) { font-size: 14px; }
}
@media (max-width: 992px) {
  .kpi-value { font-size: 15px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 32px; }
  .earnings-value { font-size: 15px; }
  .score :deep(.ant-progress-text) { font-size: 13px; }
}
@media (max-width: 768px) {
  .kpi-value { font-size: 14px; }
  .kpi-label { font-size: 9px; }
  .earnings-big-value { font-size: 28px; }
  .earnings-value { font-size: 14px; }
  .score :deep(.ant-progress-text) { font-size: 12px; }
}
@media (max-width: 576px) {
  .kpi-value { font-size: 13px; }
  .kpi-label { font-size: 8px; }
  .earnings-big-value { font-size: 24px; }
  .earnings-value { font-size: 13px; }
  .score :deep(.ant-progress-text) { font-size: 12px; }
}
</style>
