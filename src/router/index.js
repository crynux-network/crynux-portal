import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '@/components/dashboard-view.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard
    },
    {
      path: '/:network',
      name: 'network',
      component: Dashboard
    }
  ]
})

export default router
