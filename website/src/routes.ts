import type { RouteRecordRaw } from 'vue-router'

// Import page components
import Home from './views/Home.vue'

// Define all routes
export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: Home }
]
