import { createApp } from 'vue'
import { createPinia } from 'pinia'
import vuetify from './plugins/vuetify'
import App from './App.vue'
import './styles/global.scss'

createApp(App)
  .use(createPinia())
  .use(vuetify)
  .mount('#app')
