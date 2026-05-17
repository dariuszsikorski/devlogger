// @purpose Viewer entry - mounts App with React 19 root, registers passive SW.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { registerServiceWorker } from './sw/registerSw'
import './App.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

registerServiceWorker()
