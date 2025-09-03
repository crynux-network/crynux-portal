<script setup>
/* global VANTA */
import { RouterView, useRouter } from 'vue-router'
import v1 from './api/v1/v1'
import walletAPI from '@/api/v1/wallet'
import config from '@/config.json'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import {
  message,
  Button as AButton,
  Layout as ALayout,
  LayoutContent as ALayoutContent,
  LayoutFooter as ALayoutFooter,
  LayoutHeader as ALayoutHeader,
  Row as ARow,
  Col as ACol,
  Space as ASpace,
  TypographyLink as ATypographyLink,
  Dropdown as ADropdown,
  Menu as AMenu,
  MenuItem as AMenuItem,
  Select as ASelect
} from 'ant-design-vue'
import { onBeforeUnmount, onMounted, ref, computed } from 'vue'
import GithubButton from 'vue-github-button'

const [messageApi, contextHolder] = message.useMessage()

const defaultErrorHandler = () => {
  messageApi.error('Unexpected server error. Please try again later.')
}

v1.apiServerErrorHandler = defaultErrorHandler
v1.apiUnknownErrorHandler = defaultErrorHandler

const vantaRef = ref(null)
const router = useRouter()

let wavesEffect = null
onMounted(() => {
  wavesEffect = VANTA.WAVES({
    el: vantaRef.value,
    waveSpeed: 0.7,
    zoom: 1,
    waveHeight: 10,
    shininess: 50
  })
})
onBeforeUnmount(() => {
  if (wavesEffect) {
    wavesEffect.destroy()
  }
})

const auth = useAuthStore()
const wallet = useWalletStore()

const networks = [
  { key: 'dymension', name: config.networks.dymension.chainName },
  { key: 'near', name: config.networks.near.chainName }
]

const selectedNetworkKey = computed({
  get: () => wallet.selectedNetworkKey,
  set: (val) => wallet.setSelectedNetwork(val)
})

async function refreshAccountAndBalance() {
  const provider = window.ethereum
  if (!provider) return
  const accounts = await provider.request({ method: 'eth_accounts' })
  const address = accounts && accounts.length ? accounts[0] : null
  wallet.setAccount(address)
  if (address) {
    let chainId = null
    try {
      chainId = await provider.request({ method: 'eth_chainId' })
    } catch (e) {
      chainId = null
    }
    wallet.setChainId(chainId)
    await wallet.fetchBalance()
  } else {
    wallet.setBalanceWei('0x0')
  }
}

async function ensureProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    messageApi.error('Please install MetaMask in your browser.')
    return null
  }
  return window.ethereum
}

async function connect() {
  const provider = await ensureProvider()
  if (!provider) return
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    const address = accounts[0]
    wallet.setAccount(address)

    const timestamp = Math.floor(Date.now() / 1000)
    const action = 'Connect Wallet'
    const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${address}\nTimestamp: ${timestamp}`
    const signature = await provider.request({
      method: 'personal_sign',
      params: [messageToSign, address]
    })

    await wallet.ensureNetworkOnWallet(wallet.selectedNetworkKey)
    await refreshAccountAndBalance()

    const resp = await walletAPI.connectWallet({ address, signature, timestamp })
    auth.setSession(resp.token, resp.expires_at)
    router.push('/dashboard')
  } catch (err) {
    messageApi.error('Connect failed or was rejected.')
  }
}

async function changeNetwork(val) {
  wallet.setSelectedNetwork(val)
  await wallet.ensureNetworkOnWallet(val)
  await refreshAccountAndBalance()
}

function signOut() {
  auth.clearSession()
  wallet.setAccount(null)
  router.push('/')
}

onMounted(async () => {
  await refreshAccountAndBalance()
  const provider = window.ethereum
  if (provider) {
    provider.on('accountsChanged', async () => {
      await refreshAccountAndBalance()
    })
    provider.on('chainChanged', async () => {
      await refreshAccountAndBalance()
    })
  }
})
</script>

<template>
  <div id="bg-container" ref="vantaRef">
    <div id="content-container">
      <context-holder />
      <a-layout style="min-height: 100%; background: transparent">
        <a-layout-header
          style="height: 80px; line-height: 80px; padding: 0 50px; background: transparent"
        >
          <a-row justify="space-between" align="middle" style="height: 100%">
            <a-col>
              <img
                src="@/components/logo-full-white.png"
                alt="Crynux Logo"
                style="height: 50px; display: block"
              />
            </a-col>
            <a-col>
              <a-space size="large" align="center">
                <template v-if="auth.isAuthenticated && wallet.isConnected">
                  <a-select
                    v-model:value="selectedNetworkKey"
                    style="min-width: 220px"
                    :options="networks.map(n => ({ label: n.name, value: n.key }))"
                    @change="changeNetwork"
                  />
                  <a-dropdown>
                    <a-button ghost size="large" class="connect-button-ghost">
                      {{ wallet.shortAddress() }}
                    </a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item key="signout" @click="signOut">Sign Out</a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </template>
                <template v-else>
                  <a-button ghost size="large" class="connect-button-ghost" @click="connect">Connect</a-button>
                </template>
              </a-space>
            </a-col>
          </a-row>
        </a-layout-header>
        <a-layout-content style="background: transparent">
          <RouterView />
        </a-layout-content>
        <a-layout-footer
          style="background: transparent; padding: 0; margin-top: 24px; margin-bottom: 24px"
        >
          <a-row>
            <a-col :span="20" :offset="2">
              <div class="bottom-bar">
                <a-space class="footer-links">
                  <a-typography-link href="https://crynux.io" target="_blank"
                    >Home</a-typography-link
                  >
                  &nbsp;|&nbsp;
                  <a-typography-link href="https://docs.crynux.io" target="_blank"
                    >Docs</a-typography-link
                  >
                  &nbsp;|&nbsp;
                  <a-typography-link href="https://blog.crynux.io" target="_blank"
                    >Blog</a-typography-link
                  >
                  &nbsp;|&nbsp;
                  <a-typography-link href="https://x.com/crynuxio" target="_blank"
                    >Twitter
                  </a-typography-link>
                  &nbsp;|&nbsp;
                  <a-typography-link href="https://discord.gg/Ug2AHUbrrm" target="_blank"
                    >Discord
                  </a-typography-link>
                  &nbsp;|&nbsp;
                  <!-- Place this tag where you want the button to render. -->
                  <github-button
                    href="https://github.com/crynux-network/crynux-node"
                    data-color-scheme="no-preference: light; light: light; dark: light;"
                    data-show-count="true"
                    aria-label="Star Crynux Node on GitHub"
                    :style="{ position: 'relative', top: '4px' }"
                    >Star
                  </github-button>
                </a-space>
                <img
                  class="footer-logo"
                  src="@/components/logo-full-white.png"
                  width="140"
                  alt="Crynux logo"
                />
              </div>
            </a-col>
          </a-row>
        </a-layout-footer>
      </a-layout>
    </div>
  </div>
</template>
<style lang="stylus"></style>
<style lang="stylus" scoped>
#bg-container,
#content-container
  position relative
  width 100%
  height 100%

#content-container
  overflow-y auto
  overflow-x hidden

.bottom-bar
  width 100%
  height 60px
  bottom 0
  left 0
  padding 0 32px
  display flex
  justify-content space-between
  align-items center

.footer-links
  color #fff
  opacity 0.8
  a
    color #fff
    &:hover
      text-decoration underline

.footer-logo
  opacity 0.8

.connect-button-ghost:hover,
.connect-button-ghost:focus
  background rgba(255, 255, 255, 0.2) !important
  color #fff !important
  border-color #fff !important
</style>
