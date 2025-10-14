import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import Antd, { message } from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import v1 from '@/api/v1/v1'
import { useAuthStore } from '@/stores/auth'
import v2 from '@/api/v2/v2'
import { useWalletStore } from '@/stores/wallet'

import 'ant-design-vue/dist/reset.css'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)
app.use(Antd)

v1.setAuthTokenGetter(() => {
  try {
    const auth = useAuthStore()
    if (!auth || !auth.isAuthenticated) return null
    return auth.sessionToken
  } catch (_) {
    return null
  }
})

const handleUnauthorized = () => {
  try { message.error('Session expired. Please sign in again.') } catch (e) { console.error('Failed to show message:', e) }
  try { const auth = useAuthStore(); if (auth && auth.$reset) auth.$reset() } catch (e) { console.error('Failed to reset auth store:', e) }
  try { const wallet = useWalletStore(); if (wallet && wallet.$reset) wallet.$reset() } catch (e) { console.error('Failed to reset wallet store:', e) }
  try { router.push('/') } catch (e) { console.error('Failed to navigate home:', e) }
}

v1.apiUnauthorizedErrorHandler = handleUnauthorized
try { v2.apiUnauthorizedErrorHandler = handleUnauthorized } catch (e) { console.error('Failed to set v2 unauthorized handler:', e) }

app.mount('#app')
