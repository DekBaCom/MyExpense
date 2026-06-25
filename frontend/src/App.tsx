import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage from './pages/ExpensesPage'
import BudgetPage from './pages/BudgetPage'
import MembersPage from './pages/MembersPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse text-lg">กำลังโหลด...</div>
      </div>
    )
  }
  if (isError || !user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="budget" element={<BudgetPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
