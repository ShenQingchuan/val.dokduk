import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('../views/Auth.vue'),
  },
  {
    path: '/player/:name/:tag',
    name: 'Player',
    component: () => import('../views/Player.vue'),
  },
  {
    path: '/player/:name/:tag/matches',
    redirect: to => ({
      name: 'Player',
      params: { name: to.params.name, tag: to.params.tag },
      query: { tab: 'matches' },
    }),
  },
  {
    path: '/match/:matchId',
    name: 'Match',
    component: () => import('../views/Match.vue'),
  },
]

const router: ReturnType<typeof createRouter> = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
