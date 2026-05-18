import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './components/LoginPage'
import TreasuryApp from './components/TreasuryApp'

function Inner() {
  const { session, loading } = useAuth()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#888' }}>
      Cargando...
    </div>
  )

  return session ? <TreasuryApp /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  )
}
