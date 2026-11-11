import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-sans-condensed/latin-400.css'
import '@fontsource/ibm-plex-sans-condensed/latin-600.css'
import './styles.css'
import './workstation/workstation.css'
import './workstation/responsive.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
