<script setup>
/* global VANTA */
import { RouterView, useRouter } from 'vue-router'
import v1 from './api/v1/v1'
import { walletAPI } from '@/api/v1/wallet'
import config from '@/config.json'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { ethers } from 'ethers'
import {
  message,
  Modal,
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
  MenuDivider as AMenuDivider
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
let isAuthenticating = false
let reauthModalVisible = false

function reauthWithFocusAndDelay() {
  if (typeof window !== 'undefined' && window.focus) window.focus()
  return new Promise(resolve => setTimeout(resolve, 200)).then(() => authenticate({ navigate: false }))
}

const networks = [
  { key: 'dymension', name: config.networks.dymension.chainName, logo: '/dymension-square.png' },
  { key: 'near', name: config.networks.near.chainName, logo: '/near-square.png' }
]

const selectedNetworkKey = computed({
  get: () => wallet.selectedNetworkKey,
  set: (val) => wallet.setSelectedNetwork(val)
})

const selectedNetwork = computed(() => {
  return networks.find(n => n.key === selectedNetworkKey.value) || networks[0]
})

const showNetworkDropdown = ref(false)
function toggleNetworkDropdown() {
  showNetworkDropdown.value = !showNetworkDropdown.value
}
function selectNetwork(key) {
  showNetworkDropdown.value = false
  changeNetwork(key)
}
function handleClickOutside() {
  showNetworkDropdown.value = false
}

const isDashboard = computed(() => router.currentRoute.value?.name === 'dashboard')

async function refreshAccountAndBalance() {
  const provider = window.ethereum
  if (!provider) return
  const accounts = await provider.request({ method: 'eth_accounts' })
  let address = accounts && accounts.length ? accounts[0] : null
  if (address) {
    try {
      address = ethers.getAddress(address)
    } catch (e) {
      address = null
    }
  }
  const prevAddress = wallet.address
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
    auth.clearSession()
  }
  const sessionAddr = auth.sessionAddress || null
  const mismatchWithSession = !!(address && sessionAddr && sessionAddr.toLowerCase() !== address.toLowerCase())
  const addressChanged = !!(address && prevAddress && address !== prevAddress)
  if (address && (mismatchWithSession || addressChanged)) {
    promptReauth()
  }
}

function authenticate(options = { navigate: false }) {
  if (isAuthenticating) return Promise.resolve()
  const provider = window.ethereum
  if (!provider) {
    messageApi.error('Please install MetaMask in your browser.')
    return Promise.reject(new Error('No provider'))
  }
  isAuthenticating = true
  const timestamp = Math.floor(Date.now() / 1000)
  const action = 'Connect Wallet'
  return provider.request({ method: 'eth_requestAccounts' })
    .then((accounts) => {
      const acct = (accounts && accounts.length) ? accounts[0] : null
      if (!acct) throw new Error('No account connected')
      const addressToAuth = ethers.getAddress(acct)
      const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${addressToAuth}\nTimestamp: ${timestamp}`
      return provider.request({
        method: 'personal_sign',
        params: [messageToSign, addressToAuth]
      }).then(signature => ({ signature, addressToAuth }))
    })
    .then(({ signature, addressToAuth }) => walletAPI.connectWallet({ address: addressToAuth, signature, timestamp })
      .then(resp => ({ resp, addressToAuth })))
    .then(({ resp, addressToAuth }) => {
      auth.setSession(resp.token, resp.expires_at, addressToAuth)
      wallet.setAccount(addressToAuth)
      return wallet.ensureNetworkOnWallet(wallet.selectedNetworkKey)
        .then(() => refreshAccountAndBalance())
        .then(() => {
          if (options.navigate) {
            router.push('/dashboard')
          } else {
            messageApi.success('Re-authenticated')
          }
        })
    })
    .catch(() => {
      auth.clearSession()
      messageApi.error('Authentication failed or was rejected')
    })
    .finally(() => {
      isAuthenticating = false
      reauthModalVisible = false
    })
}

function promptReauth() {
  if (reauthModalVisible || isAuthenticating) return
  reauthModalVisible = true
  Modal.confirm({
    title: 'Authentication Required',
    content: 'Your wallet account changed. Please re-authenticate to continue.',
    okText: 'Re-authenticate',
    okCancel: false,
    onOk: () => {
      return reauthWithFocusAndDelay()
    },
  })
}

async function connect() {
  return authenticate({ navigate: true })
}

async function changeNetwork(val) {
  const switched = await wallet.ensureNetworkOnWallet(val)
  if (!switched) {
    messageApi.error('Failed to switch network in wallet')
    return
  }
  wallet.setSelectedNetwork(val)
  await refreshAccountAndBalance()
}

async function performSignOut() {
  const provider = window.ethereum
  if (provider && provider.request) {
    try {
      await provider.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      })
    } catch (e) {
      console.error('Failed to revoke permissions:', e)
      messageApi.error('Could not disconnect from wallet. Please switch accounts in MetaMask manually.')
    }
  }
  auth.$reset()
  wallet.$reset()
  router.push('/')
}

function confirmSignOut() {
  Modal.confirm({
    title: 'Confirm Sign Out',
    content: 'Are you sure you want to sign out?',
    okText: 'Sign Out',
    cancelText: 'Cancel',
    okButtonProps: { danger: true },
    onOk: () => performSignOut()
  })
}

onMounted(async () => {
  await refreshAccountAndBalance()
  const provider = window.ethereum
  if (provider) {
    let accountChangeTimer = null
    provider.on('accountsChanged', async () => {
      if (accountChangeTimer) clearTimeout(accountChangeTimer)
      accountChangeTimer = setTimeout(async () => {
        await refreshAccountAndBalance()
      }, 800)
    })
    provider.on('chainChanged', async () => {
      await refreshAccountAndBalance()
    })
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
              <a-space align="center" size="middle">
                <img
                  src="/logo-graphic-white.png"
                  alt="Crynux Logo"
                  style="height: 50px; display: block; cursor: pointer"
                  @click="router.push({ name: 'netstats' })"
                />
                <a-typography-link @click="router.push({ name: 'netstats' })" class="brand-text" style="color: #fff; font-size: 20px; cursor: pointer">Crynux Portal</a-typography-link>
              </a-space>
            </a-col>
            <a-col>
              <a-space size="large" align="center">
                <template v-if="auth.isAuthenticated && wallet.isConnected">
                  <div v-if="isDashboard" class="network-selector" @click.stop="toggleNetworkDropdown">
                    <img :src="selectedNetwork.logo" alt="Network Logo" class="network-logo">
                    <span class="network-name">{{ selectedNetwork.name }}</span>
                    <span class="dropdown-arrow">▼</span>
                    <div class="network-dropdown" v-if="showNetworkDropdown" @click.stop>
                      <div
                        v-for="n in networks"
                        :key="n.key"
                        class="network-option"
                        @click="selectNetwork(n.key)"
                      >
                        <img :src="n.logo" :alt="n.name" class="network-option-logo">
                        <span class="network-option-name">{{ n.name }}</span>
                      </div>
                    </div>
                  </div>
                  <a-dropdown>
                    <a-button ghost size="large" class="connect-button-ghost">
                      {{ wallet.shortAddress() }}
                    </a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item key="dashboard" @click="router.push('/dashboard')">Dashboard</a-menu-item>
                        <a-menu-divider style="margin: 10px 0" />
                        <a-menu-item key="signout" @click="confirmSignOut">Sign Out</a-menu-item>
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
                  src="/logo-full-white.png"
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

.brand-text
  font-family -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif
  font-weight 600
  letter-spacing 0.2px
  line-height 1

.connect-button-ghost:hover,
.connect-button-ghost:focus
  background rgba(255, 255, 255, 0.2) !important
  color #fff !important
  border-color #fff !important

.network-selector
  position relative
  top 1px
  cursor pointer
  background-color rgba(0, 0, 0, 0.3)
  border none
  border-radius 10px
  padding 0 12px
  height 32px
  line-height normal
  display inline-flex
  align-items center
  gap 8px
  color #fff
  align-self center

.network-logo
  height 16px
  width 16px
  object-fit contain
  display block

.network-name
  font-size 14px
  line-height 1
  opacity 0.95

.dropdown-arrow
  margin-left 6px
  font-size 10px
  color #fff
  opacity 0.8

.network-dropdown
  position absolute
  top calc(100% + 6px)
  right 0
  background rgba(0, 0, 0, 0.75)
  border 1px solid rgba(255, 255, 255, 0.18)
  border-radius 10px
  min-width 240px
  padding 6px
  z-index 1000
  box-shadow 0 6px 20px rgba(0,0,0,0.3)

.network-option
  display flex
  align-items center
  gap 8px
  padding 10px 10px
  border-radius 8px
  transition background-color 0.2s
  white-space nowrap

  &:hover
    background-color rgba(255, 255, 255, 0.12)

.network-option-logo
  height 18px
  width 18px
  object-fit contain
  display block

.network-option-name
  font-size 13px
  color #fff
  white-space nowrap
  overflow hidden
  text-overflow ellipsis
  flex 1
  min-width 0
</style>
