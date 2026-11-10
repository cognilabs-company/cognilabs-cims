import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/i18n/i18n'
import { initTheme } from './shared/theme/theme'
import App from './App.tsx'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
