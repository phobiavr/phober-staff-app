import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { TvPinProvider } from './contexts/TvPinContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SessionsPage from './pages/SessionsPage'
import CustomersPage from './pages/CustomersPage'
import InvoicesPage from './pages/InvoicesPage'
import TariffsPage from './pages/TariffsPage'
import BarPage from './pages/BarPage'
import TVPage from './pages/TVPage'

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <ToastProvider>
      <TvPinProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<HomePage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/invoices"  element={<InvoicesPage />} />
            <Route path="/tariffs"   element={<TariffsPage />} />
            <Route path="/bar"       element={<BarPage />} />
          </Route>
          <Route path="/tv" element={<TVPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </TvPinProvider>
      </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
