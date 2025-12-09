<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import config from '@/config.json'
import MyDelegation from '@/components/staking/my-delegation.vue'

const wallet = useWalletStore()
const auth = useAuthStore()

const networkName = computed(() => {
  const key = wallet.selectedNetworkKey
  return (config.networks[key] && config.networks[key].chainName) || key
})
</script>

<template>
  <div class="top-spacer"></div>
  <a-row :gutter="[16, 16]">
    <a-col :span="24">
      <a-card title="My Delegations" :bordered="false" style="opacity: 0.9">
        <MyDelegation />
      </a-card>
    </a-col>
  </a-row>
</template>

<style scoped lang="stylus">
.top-spacer
  height 20px
</style>
