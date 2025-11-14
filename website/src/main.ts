import { createApp } from 'vue'
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

// Import the main App component (same as SSG)
import App from './App.vue'

// Import global styles
import './styles/global.css'

// Import routes
import { routes } from './routes.ts'

// Create router
const router = createRouter({
  history: createWebHistory('/'),
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
  const full = window.location.pathname + window.location.search + window.location.hash
  const currentFull = current.fullPath

  // only replace if path truly mismatched (not just queries)
  if (currentFull !== full) {
    router.replace(full)
  }
}

app.mount('#app')