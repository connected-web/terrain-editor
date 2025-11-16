import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

// Import the main App component (same as SSG)
import App from './App.vue'

// Import global styles
import './styles/global.css'

// Import routes
import { routes } from './routes.ts'

function detectBasePath() {
  const configuredBase = import.meta.env.BASE_URL
  if (configuredBase && configuredBase !== '.' && configuredBase !== './') {
    return configuredBase
  }
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path.startsWith('/terrain-editor')) return '/terrain-editor/'
  }
  return '/'
}

const routerBase = detectBasePath()

// Create router
const router = createRouter({
  history: createWebHistory(routerBase),
  routes,
  scrollBehavior(to: RouteLocationNormalized, _from: RouteLocationNormalized, savedPosition: any) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

// Create and mount app
const app = createApp(App)
app.use(router)

// For hydration, ensure router knows the current location
if (typeof window !== 'undefined') {
  const current = router.currentRoute.value
  const pathname = window.location.pathname
  const baseWithoutTrailing = routerBase.endsWith('/')
    ? routerBase.slice(0, -1)
    : routerBase
  const relativePath = pathname.startsWith(baseWithoutTrailing)
    ? pathname.slice(baseWithoutTrailing.length) || '/'
    : pathname
  const full = relativePath + window.location.search + window.location.hash
  const currentFull = current.fullPath

  if (currentFull !== full) {
    router.replace(full)
  }
}

app.mount('#app')
