import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Clarity from '@microsoft/clarity'
import vuetify from './plugins/vuetify'
import App from './App.vue'
import './styles/global.scss'
import 'iconify-icon'

Clarity.init('wqfcdvm83x')

createApp(App)
  .use(createPinia())
  .use(vuetify)
  .mount('#app')
