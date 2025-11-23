import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import setupIcons from './icons'

const app = createApp(App)
setupIcons(app)
app.mount('#app')
