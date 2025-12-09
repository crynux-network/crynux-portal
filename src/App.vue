<script setup>
/* global VANTA */
import { RouterView, useRouter } from 'vue-router'
import v1 from './api/v1/v1'
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
  MenuDivider as AMenuDivider,
  Input as AInput
} from 'ant-design-vue'
import { SearchOutlined, MenuOutlined, WalletOutlined, DollarOutlined, LogoutOutlined } from '@ant-design/icons-vue'
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
const searchAddress = ref('')

function handleSearchEnter() {
  const address = searchAddress.value.trim()
  if (!address) return
  if (!ethers.isAddress(address)) {
    messageApi.error('Invalid address')
    return
  }
  router.push({ name: 'node-details', params: { address } })
  searchAddress.value = ''
}

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
let reauthModalVisible = false
const mobileMenuOpen = ref(false)

function reauthWithFocusAndDelay() {
  if (typeof window !== 'undefined' && window.focus) window.focus()
  return new Promise(resolve => setTimeout(resolve, 200)).then(() => connect())
}

const networks = [
  { key: 'dymension', name: config.networks.dymension.chainName, logo: '/dymension-square.png' },
  { key: 'near', name: config.networks.near.chainName, logo: '/near-square.png' }
]

const selectedNetworkKey = computed(() => wallet.selectedNetworkKey)

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

const isDashboard = computed(() => router.currentRoute.value?.path?.startsWith('/dashboard'))

async function refreshAccountAndBalance() {
  const result = await wallet.refreshAccountAndBalance()
  if (result.address && result.changed) {
    promptReauth()
  }
}

function promptReauth() {
  if (reauthModalVisible || auth.isAuthenticating) return
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
  const result = await auth.authenticate()
  if (!result.success) {
    if (result.reason === 'no_provider') {
      messageApi.error('Please install MetaMask in your browser.')
    } else if (result.reason === 'auth_failed') {
      messageApi.error('Authentication failed or was rejected')
    }
  }
  reauthModalVisible = false
  return result
}

async function changeNetwork(val) {
  const switched = await wallet.ensureNetworkOnWallet(val)
  if (!switched) {
    messageApi.error('Failed to switch network in wallet')
    return
  }
  await refreshAccountAndBalance()
}

async function performSignOut() {
  const result = await wallet.disconnect()
  if (!result.success) {
    messageApi.error('Could not disconnect from wallet. Please switch accounts in MetaMask manually.')
  }
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
  const provider = window.ethereum
  if (provider) {
    try {
      await wallet.ensureNetworkOnWallet(wallet.selectedNetworkKey)
    } catch (e) { messageApi.error("Couldn't set the selected network automatically. Please refresh and try again.") }
  }
  await refreshAccountAndBalance()
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
        <a-layout-header class="app-header">
          <div class="header-inner">
            <a-row class="top-row" align="middle" justify="space-between">
              <a-col :xs="{ span: 18 }" :sm="{ span: 18 }" :md="{ span: 6 }">
                <a-space align="center" size="middle" class="brand" @click="router.push({ name: 'netstats' })">
                  <img
                    src="/logo-graphic-white.png"
                    alt="Crynux Logo"
                    class="brand-logo"
                  />
                  <a-typography-link class="brand-text" style="color: #fff; font-size: 20px; cursor: pointer">Crynux Portal</a-typography-link>
                </a-space>
              </a-col>
              <a-col :xs="{ span: 0 }" :sm="{ span: 0 }" :md="{ span: 12 }" class="search-desktop">
                <div class="search-desktop-center">
                  <a-input
                    v-if="!isDashboard"
                    v-model:value="searchAddress"
                    placeholder="Search node address"
                    class="header-search-input"
                    :bordered="false"
                    @pressEnter="handleSearchEnter"
                  >
                    <template #prefix>
                      <SearchOutlined style="color: rgba(255, 255, 255, 0.6); margin-right: 4px;" />
                    </template>
                  </a-input>
                </div>
              </a-col>
              <a-col :xs="{ span: 6 }" :sm="{ span: 6 }" :md="{ span: 6 }" class="actions-col">
                <div class="actions">
                  <div class="nav-desktop">
                    <a-space size="large" align="center">
                      <template v-if="!isDashboard">
                        <a-button type="link" class="nav-button" :class="{ active: router.currentRoute.value.name === 'netstats' }" @click="router.push({ name: 'netstats' })">Netstats</a-button>
                        <a-button type="link" class="nav-button" :class="{ active: router.currentRoute.value.name === 'staking' }" @click="router.push({ name: 'staking' })">Staking</a-button>
                      </template>
                      <template v-if="auth.isAuthenticated">
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
                        <a-dropdown :trigger="['hover']">
                          <a-button ghost size="large" class="connect-button-ghost">
                            {{ wallet.shortAddress() }}
                          </a-button>
                          <template #overlay>
                            <a-menu>
                              <a-menu-item key="relay-account" @click="router.push({ name: 'relay-account' })">
                                <template #icon><WalletOutlined /></template>
                                Relay Account
                              </a-menu-item>
                              <a-menu-item key="delegated-staking" @click="router.push({ name: 'delegated-staking' })">
                                <template #icon><DollarOutlined /></template>
                                Delegated Stake
                              </a-menu-item>
                              <a-menu-divider style="margin: 10px 0" />
                              <a-menu-item key="signout" @click="confirmSignOut">
                                <template #icon><LogoutOutlined /></template>
                                Sign Out
                              </a-menu-item>
                            </a-menu>
                          </template>
                        </a-dropdown>
                      </template>
                      <template v-else>
                        <a-button ghost size="large" class="connect-button-ghost" @click="connect">Connect</a-button>
                      </template>
                    </a-space>
                  </div>
                  <div class="menu-toggle">
                    <a-button type="text" ghost @click="mobileMenuOpen = true" aria-label="Open menu">
                      <MenuOutlined style="font-size: 22px; color: #fff;" />
                    </a-button>
                  </div>
                </div>
              </a-col>
            </a-row>
            <div class="search-mobile" v-if="!isDashboard">
              <a-input
                v-model:value="searchAddress"
                placeholder="Search node address"
                class="header-search-input mobile"
                :bordered="false"
                @pressEnter="handleSearchEnter"
              >
                <template #prefix>
                  <SearchOutlined style="color: rgba(255, 255, 255, 0.6); margin-right: 4px;" />
                </template>
              </a-input>
            </div>
          </div>
        </a-layout-header>
        <a-drawer
          :open="mobileMenuOpen"
          placement="right"
          :width="280"
          @close="mobileMenuOpen = false"
          root-class-name="header-drawer"
          :body-style="{ padding: '16px', background: '#fff' }"
          :header-style="{ background: '#fff' }"
        >
          <template #extra>
            <span
              v-if="auth.isAuthenticated"
              class="drawer-address"
            >{{ wallet.shortAddress() }}</span>
          </template>
          <a-space direction="vertical" style="width: 100%;">
            <a-button type="text" block class="drawer-nav-btn"
              :class="{ active: router.currentRoute.value.name === 'netstats' }"
              @click="router.push({ name: 'netstats' }); mobileMenuOpen = false"
            >Netstats</a-button>
            <a-button type="text" block class="drawer-nav-btn"
              :class="{ active: router.currentRoute.value.name === 'staking' }"
              @click="router.push({ name: 'staking' }); mobileMenuOpen = false"
            >Staking</a-button>
            <template v-if="auth.isAuthenticated">
              <a-button
                type="text"
                block
                class="drawer-nav-btn"
                :class="{ active: router.currentRoute.value.name === 'relay-account' }"
                @click="router.push({ name: 'relay-account' }); mobileMenuOpen = false"
              >Relay Account</a-button>
              <a-button
                type="text"
                block
                class="drawer-nav-btn"
                :class="{ active: router.currentRoute.value.name === 'delegated-staking' }"
                @click="router.push({ name: 'delegated-staking' }); mobileMenuOpen = false"
              >Delegated Stake</a-button>
            </template>
            <div class="drawer-separator"></div>
            <template v-if="auth.isAuthenticated">
              <div class="network-selector" @click.stop="toggleNetworkDropdown">
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
              <a-button block danger type="primary" ghost style="margin-top: 4px;" @click="confirmSignOut(); mobileMenuOpen = false">Sign Out</a-button>
            </template>
            <template v-else>
              <a-button
                block
                ghost
                size="large"
                class="connect-button-ghost"
                :style="{ color: '#1677ff', borderColor: '#1677ff', background: '#fff' }"
                @click="connect(); mobileMenuOpen = false"
              >Connect</a-button>
            </template>
          </a-space>
        </a-drawer>
        <a-layout-content style="background: transparent">
          <div class="responsive-container">
            <RouterView />
          </div>
        </a-layout-content>
        <a-layout-footer
          style="background: transparent; padding: 0; margin-top: 24px; margin-bottom: 24px"
        >
          <div class="responsive-container">
            <div class="bottom-bar">
              <a-space class="footer-links" :wrap="true">
                <a-typography-link :href="config.social_links.home" target="_blank"
                  >Home</a-typography-link
                >
                &nbsp;|&nbsp;
                <a-typography-link :href="config.social_links.docs" target="_blank"
                  >Docs</a-typography-link
                >
                &nbsp;|&nbsp;
                <a-typography-link :href="config.social_links.blog" target="_blank"
                  >Blog</a-typography-link
                >
                &nbsp;|&nbsp;
                <a-typography-link :href="config.social_links.twitter" target="_blank"
                  >Twitter
                </a-typography-link>
                &nbsp;|&nbsp;
                <a-typography-link :href="config.social_links.discord" target="_blank"
                  >Discord
                </a-typography-link>
                &nbsp;|&nbsp;
                <!-- Place this tag where you want the button to render. -->
                <github-button
                  :href="config.social_links.github + '/crynux-node'"
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
          </div>
        </a-layout-footer>
      </a-layout>
    </div>
  </div>
</template>
<style lang="stylus">
.header-drawer
  .ant-drawer-header
    background #fff
  .ant-drawer-body
    background #fff

  .ant-drawer-body .connect-button-ghost.ant-btn
    color #1677ff !important
    border-color #1677ff !important
    background-color #fff !important
    transition background-color .2s ease, border-color .2s ease, color .2s ease, box-shadow .2s ease

  .ant-drawer-body .connect-button-ghost.ant-btn:hover,
  .ant-drawer-body .connect-button-ghost.ant-btn:focus
    background-color #fff !important
    color #0958d9 !important
    border-color #0958d9 !important

  .ant-drawer-body .connect-button-ghost.ant-btn:active
    background-color #fff !important
    color #003eb3 !important
    border-color #003eb3 !important

  .drawer-address
    color #777
    font-size 12px
    user-select text

  /* Light theme overrides for network selector inside white drawer */
  .ant-drawer-body .network-selector
    background-color #f5f5f5
    color #111
    border none
    border-radius 10px
    padding 0 12px
    height 40px
    display flex
    width 100%
    justify-content space-between
    align-items center
    gap 8px
    transition background-color .2s ease
    box-sizing border-box
    margin-top 4px

  .ant-drawer-body .network-selector .dropdown-arrow
    color #555
    opacity 0.9

  .ant-drawer-body .network-dropdown
    background #fff
    border 1px solid #eaeaea
    border-radius 10px
    box-shadow 0 8px 24px rgba(0,0,0,0.08)
    left 0
    right auto
    min-width 0
    width 100%
    top calc(100% + 6px)
    z-index 1001

  .ant-drawer-body .network-option
    &:hover
      background-color #f5f5f5

  .ant-drawer-body .network-option-name
    color #333

  .ant-drawer-body .network-name
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
    flex 1
    min-width 0
</style>
<style lang="stylus" scoped>
.app-header
  height 80px
  line-height 1
  padding 0 50px
  background transparent

  @media (max-width: 992px)
    height auto
    padding 16px 24px 12px

.header-inner
  display block

.top-row
  height 80px

  @media (max-width: 992px)
    height 56px

.brand
  cursor pointer
  white-space nowrap
  display inline-flex
  align-items center
  gap 12px

.brand-logo
  height 50px
  display block
  cursor pointer
  flex-shrink 0

.responsive-container
  width 100%
  max-width 1400px
  margin 0 auto
  padding 0 24px
  box-sizing border-box

  @media (max-width: 768px)
    padding 0 16px

#bg-container,
#content-container
  position relative
  width 100%
  height 100%

#content-container
  overflow-y auto
  overflow-x hidden

.search-desktop
  display block

.search-desktop-center
  display flex
  justify-content center
  align-items center

.actions-col
  display flex
  justify-content flex-end

.actions
  display flex
  align-items center
  justify-content flex-end
  gap 8px

.nav-desktop
  display block

.menu-toggle
  display none

@media (max-width: 992px)
  .nav-desktop
    display none
  .menu-toggle
    display block
  .search-desktop
    display none

.search-mobile
  display none
  margin 16px 0 0

@media (max-width: 992px)
  .search-mobile
    display block

.bottom-bar
  width 100%
  min-height 60px
  bottom 0
  left 0
  padding 0 8px
  display flex
  justify-content space-between
  align-items center
  flex-wrap nowrap

.footer-links
  flex 1 1 auto
  max-width calc(100% - 180px)
  color #fff
  opacity 0.8
  a
    color #fff
    &:hover
      text-decoration underline

.footer-logo
  opacity 0.8

@media (max-width: 768px)
  .bottom-bar
    padding 0 6px
  .footer-links
    max-width calc(100% - 160px)

@media (max-width: 576px)
  .bottom-bar
    flex-direction column
    align-items flex-start
    gap 8px
    padding 0 4px
  .footer-links
    max-width 100%
    width 100%
  .footer-logo
    margin-top 24px

.brand-text
  font-family -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif
  font-weight 600
  letter-spacing 0.2px
  line-height 1

.app-header .connect-button-ghost:hover,
.app-header .connect-button-ghost:focus
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
  white-space nowrap

.network-logo
  height 16px
  width 16px
  object-fit contain
  display block

.network-name
  font-size 14px
  line-height 1
  opacity 0.95
  white-space nowrap

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

.header-search-input
  width 400px
  background-color transparent
  border 1px solid rgba(255, 255, 255, 0.7)
  border-radius 6px
  color #fff
  transition all 0.3s

  &:hover, &:focus, &:focus-within
    background-color rgba(255, 255, 255, 0.1)
    border-color #fff
    box-shadow 0 0 10px rgba(255, 255, 255, 0.2)

  input
    background transparent !important
    color #fff
    &::placeholder
      color rgba(255, 255, 255, 0.7) !important

  :deep(input)
    background transparent !important
    color #fff
    &::placeholder
      color rgba(255, 255, 255, 0.7) !important
  &.mobile
    width 100%

@media (max-width: 1200px)
  .header-search-input
    width 300px

@media (max-width: 992px)
  .header-search-input
    width 100%

.nav-button
  color rgba(255, 255, 255, 0.7) !important
  font-size 18px
  padding 4px 8px !important
  height auto
  position relative

  &:hover
    color #fff !important

  &.active
    color #fff !important

    &::after
      content ''
      position absolute
      bottom -4px
      left 50%
      transform translateX(-50%)
      width 20px
      height 3px
      background-color #fff
      border-radius 2px

.drawer-nav-btn
  color #333 !important
  text-align left
  height 40px
  font-size 16px
  border-radius 8px
  padding 0 8px
  transition all 0.2s ease

  &:hover
    background #f5f5f5
    color #111 !important

  &.active
    background #e6f4ff
    color #1677ff !important

.drawer-separator
  height 1px
  background #f0f0f0
  margin 8px 0

.header-drawer
  :deep(.ant-drawer-header)
    background #fff
  :deep(.ant-drawer-body)
    background #fff

</style>

<style lang="stylus">
.ant-dropdown .ant-dropdown-menu .ant-dropdown-menu-item
  padding 10px 16px
</style>
