import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import setupIcons from './icons'
import { exposeFrameCaptureAPI } from './utils/frameCapture'

const app = createApp(App)
setupIcons(app)
app.mount('#app')

// Expose frame capture API for Playwright testing
exposeFrameCaptureAPI()
