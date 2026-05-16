// @purpose Viewer entry - mounts App with React 19 root.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './App.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
