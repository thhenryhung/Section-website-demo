import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { SectionDataProvider } from './gate/SectionData'
import { initTheme } from './lib/theme'

initTheme()

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SectionDataProvider>
        <App />
      </SectionDataProvider>
    </BrowserRouter>
  </StrictMode>,
)
