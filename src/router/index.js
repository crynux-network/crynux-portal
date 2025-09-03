import { createRouter, createWebHashHistory } from 'vue-router'
import NetstatsView from '@/components/netstats/netstats-view.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'netstats',
      component: NetstatsView
    },
    {
      path: '/:network',
      name: 'network',
      component: NetstatsView
    }
  ]
})

export default router
