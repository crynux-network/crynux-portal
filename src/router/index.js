import { createRouter, createWebHashHistory } from 'vue-router'
import NetstatsView from '@/components/netstats/netstats-view.vue'
import UserDashboard from '@/components/user-dashboard.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'netstats',
      component: NetstatsView
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: UserDashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/:network',
      name: 'network',
      component: NetstatsView
    }
  ]
})
router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  const valid = auth.isAuthenticated
  if (to.matched.some(record => record.meta && record.meta.requiresAuth)) {
    if (valid) {
      next()
    } else {
      next({ path: '/' })
    }
  } else {
    next()
  }
})

export default router
