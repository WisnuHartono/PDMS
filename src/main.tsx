import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { ErrorBoundary, DialogHost, BrandEffects } from './ui'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrandEffects />
    <App />
    <DialogHost />
  </ErrorBoundary>,
)
