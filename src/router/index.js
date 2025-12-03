import { createRouter, createWebHashHistory } from 'vue-router'
import NetstatsView from '@/components/netstats/netstats-view.vue'
import StakeableNodes from '@/components/staking/stakeable-nodes.vue'
import UserDashboard from '@/components/user-dashboard.vue'
import NodeDetails from '@/components/staking/node-details.vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'netstats',
      component: NetstatsView
    },
    {
      path: '/staking',
      name: 'staking',
      component: StakeableNodes
    },
    {
      path: '/nodes/:address',
      name: 'node-details',
      component: NodeDetails
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: UserDashboard,
      meta: { requiresAuth: true }
    }
  ]
})
router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  const wallet = useWalletStore()
  const isAuthed = auth.isAuthenticated
  const hasProvider = typeof window !== 'undefined' && !!window.ethereum
  const requiresAuth = to.matched.some(record => record.meta && record.meta.requiresAuth)
  if (requiresAuth) {
    if (isAuthed && hasProvider) {
      next()
    } else {
      try {
        const provider = typeof window !== 'undefined' ? window.ethereum : null
        if (provider && provider.request) {
          await provider.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }]
          })
        }
      } catch (e) { console.warn('Failed to revoke wallet permissions', e) }
      try { auth.$reset() } catch (e) { console.warn('Failed to reset auth store', e) }
      try { wallet.$reset() } catch (e) { console.warn('Failed to reset wallet store', e) }
      next({ path: '/' })
    }
  } else {
    next()
  }
})

export default router
