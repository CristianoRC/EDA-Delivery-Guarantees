import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

const deliveryDark = {
  dark: true,
  colors: {
    background: '#0b1220',
    surface: '#161f33',
    'surface-bright': '#1f2a44',
    'surface-light': '#2a3552',
    'surface-variant': '#1f2a44',
    'on-surface-variant': '#e8edf7',
    primary: '#38bdf8',
    'primary-darken-1': '#0ea5e9',
    secondary: '#a78bfa',
    'secondary-darken-1': '#7c3aed',
    accent: '#38bdf8',
    error: '#f87171',
    info: '#38bdf8',
    success: '#4ade80',
    warning: '#fbbf24',
    producer: '#38bdf8',
    broker: '#a78bfa',
    consumer: '#fb923c',
    db: '#4ade80',
    dlq: '#ef4444',
  },
  variables: {
    'border-color': '#2a3552',
    'border-opacity': 0.6,
    'high-emphasis-opacity': 0.95,
    'medium-emphasis-opacity': 0.65,
    'theme-code': '#1f2a44',
    'theme-on-code': '#38bdf8',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: 'deliveryDark',
    themes: { deliveryDark },
  },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'md' },
    VCard: { rounded: 'lg' },
    VSelect: { variant: 'outlined', density: 'compact', hideDetails: true },
    VSlider: { hideDetails: true, density: 'compact', color: 'primary' },
    VSwitch: { hideDetails: true, density: 'compact', color: 'success' },
  },
})
