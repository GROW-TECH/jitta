import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './../index.css'
import { TaxiAppProvider } from '../context/TaxiAppContext'
import { AdminDashboardPage } from './AdminDashboardPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaxiAppProvider>
      <AdminDashboardPage />
    </TaxiAppProvider>
  </StrictMode>,
)