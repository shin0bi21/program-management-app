import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './common/styles/brand.css'
import './common/styles/forms.css'
import './common/styles/pages.css'
import './common/components/Button/Button.css'
import ErrorBoundary from './ErrorBoundary/ErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
