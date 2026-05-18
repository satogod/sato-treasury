import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('name, role').eq('id', userId).single()
    // If profile doesn't exist yet, default to admin so the UI is usable
    setProfile(data || { name: 'Usuario', role: 'admin' })
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Default to true if profile hasn't loaded yet — avoids hiding all buttons
  const isAdmin    = !profile || profile.role === 'admin'
  const isOperator = !profile || profile.role === 'admin' || profile.role === 'operator'
  const isViewer   = profile?.role === 'viewer'

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut, isAdmin, isOperator, isViewer }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
