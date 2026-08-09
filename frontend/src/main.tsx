import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import './common/styles/brand.css'
import './common/styles/forms.css'
import './common/styles/pages.css'
import './common/components/Button/Button.css'
import ErrorBoundary from './app/ErrorBoundary/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from './query/queryClient'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
