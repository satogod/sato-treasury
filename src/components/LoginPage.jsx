import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#f4f4f0',fontFamily:"'DM Sans',sans-serif",padding:'16px'
    }}>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 28px',width:'100%',maxWidth:380,border:'1.5px solid #e8e8e2'}}>
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,letterSpacing:'-0.02em'}}>SATO TREASURY</div>
          <div style={{color:'#888',fontSize:13,marginTop:4}}>Iniciá sesión para continuar</div>
        </div>
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Email</label>
            <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1.5px solid #e0e0da',fontSize:14,boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:4}}>Contraseña</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1.5px solid #e0e0da',fontSize:14,boxSizing:'border-box'}}/>
          </div>
          {error&&<div style={{background:'#fee2e2',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{background:'#0f0f0f',color:'#fff',border:'none',borderRadius:10,padding:'11px 0',fontWeight:700,fontSize:14,fontFamily:"'Syne',sans-serif",cursor:loading?'not-allowed':'pointer',opacity:loading?.6:1,marginTop:4}}>
            {loading?'Iniciando...':'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
