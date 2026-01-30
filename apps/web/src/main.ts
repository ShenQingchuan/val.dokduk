import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import router from './router'

import 'uno.css'

// Create app instance
const app = createApp(App)

// Create pinia instance
const pinia = createPinia()

// Use plugins
app.use(pinia)
app.use(PiniaColada)
app.use(router)
app.use(i18n)

// Mount app
app.mount('#app')
