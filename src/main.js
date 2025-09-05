import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import Antd from 'ant-design-vue'
import App from './App.vue'
import router from './router'
import v1 from '@/api/v1/v1'
import { useAuthStore } from '@/stores/auth'

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

app.mount('#app')
