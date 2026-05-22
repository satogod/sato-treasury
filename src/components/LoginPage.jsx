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
    try { await signIn(email, password) }
    catch (err) { setError(err.message || 'Error al iniciar sesión') }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',background:'#f6f8fa',fontFamily:"'DM Sans',sans-serif"}}>
      {/* Left panel */}
      <div style={{width:380,background:'#161b22',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'40px',flexShrink:0}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:48}}>
            <div style={{width:32,height:32,background:'#2da44e',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>₿</div>
            <span style={{fontWeight:700,fontSize:16,color:'#e6edf3',letterSpacing:'-0.02em'}}>SATO <span style={{color:'#2da44e'}}>Treasury</span></span>
          </div>
          <div style={{color:'#e6edf3',fontSize:22,fontWeight:700,lineHeight:1.3,marginBottom:16,letterSpacing:'-0.02em'}}>
            Control operativo y tesorería para cambios & crypto
          </div>
          <div style={{color:'#8b949e',fontSize:13,lineHeight:1.6}}>
            Gestioná tus cuentas, clientes, operaciones y posiciones en múltiples monedas desde un solo lugar.
          </div>
        </div>
        <div style={{fontSize:11,color:'#30363d'}}>
          v1.0 · Sistema interno
        </div>
      </div>

      {/* Right panel */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{background:'#fff',borderRadius:10,padding:'32px 28px',width:'100%',maxWidth:380,border:'1px solid #d0d7de',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{marginBottom:24}}>
            <h2 style={{fontWeight:700,fontSize:20,color:'#1f2328',letterSpacing:'-0.02em',marginBottom:4}}>Iniciar sesión</h2>
            <p style={{fontSize:13,color:'#636c76'}}>Ingresá tus credenciales para continuar</p>
          </div>
          <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <label style={{fontSize:12,fontWeight:500,color:'#636c76',display:'block',marginBottom:4}}>Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #d0d7de',fontSize:14,boxSizing:'border-box',outline:'none',color:'#1f2328'}}/>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:500,color:'#636c76',display:'block',marginBottom:4}}>Contraseña</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #d0d7de',fontSize:14,boxSizing:'border-box',outline:'none',color:'#1f2328'}}/>
            </div>
            {error&&<div style={{background:'#ffebe9',color:'#cf222e',padding:'8px 12px',borderRadius:6,fontSize:13,border:'1px solid #ff8182'}}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{background:'#2da44e',color:'#fff',border:'none',borderRadius:6,padding:'9px 0',fontWeight:600,fontSize:14,cursor:loading?'not-allowed':'pointer',opacity:loading?.7:1,marginTop:4,letterSpacing:'-0.01em'}}>
              {loading?'Iniciando sesión...':'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
