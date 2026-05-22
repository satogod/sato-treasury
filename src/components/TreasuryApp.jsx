import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  useAccounts, useClients, useOperations, useCreditBalances,
  addOperation, editOperation, deleteOperation,
  uploadAttachment, getAttachmentUrl,
  addClient, updateClient, deleteClient,
  addAccount, updateAccount, deleteAccount, updateAccountOpeningBal,
} from '../hooks/useData'

// ── Constants ─────────────────────────────────────────────────────────────────
const CURRENCIES = ['USD','PYG','USDT','BRL','EUR']
const ACC_TYPES  = ['Efectivo','Banco','Wallet Crypto','Broker/Plataforma']
const USD_RATE   = {USD:1,USDT:1,PYG:1/6200,BRL:1/5.1,EUR:1.08}
const toUSD      = (v,c) => v*(USD_RATE[c]||1)
const ACC_COLOR  = {Efectivo:'#fff8c5',Banco:'#ddf4ff','Wallet Crypto':'#dcfce7','Broker/Plataforma':'#fbefff'}
const CLI_PAL    = ['#fde047','#f9a8d4','#86efac','#93c5fd','#fdba74','#d8b4fe','#67e8f9','#fca5a5']
const cliColor   = n => CLI_PAL[(n||'X').charCodeAt(0)%CLI_PAL.length]

// ── Format ────────────────────────────────────────────────────────────────────
const FMT = {
  USD:  v=>'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
  PYG:  v=>'₲'+Math.abs(v).toLocaleString('es-PY',{maximumFractionDigits:0}),
  USDT: v=>Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' T',
  BRL:  v=>'R$'+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),
  EUR:  v=>'€'+Math.abs(v).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}),
}
const fmt   = (v,c) => { if(v==null||isNaN(v)) return '—'; const fn=FMT[c]||(x=>Math.abs(x).toFixed(2)+' '+c); return (v<0?'-':'')+fn(v) }
const uid   = () => Math.random().toString(36).slice(2,9)

// ── Timezone UTC-3 helper ────────────────────────────────────────────────────
const nowUTC3 = () => {
  const d = new Date()
  d.setHours(d.getHours() - 3)  // UTC-3
  return d.toISOString().slice(0,16)
}
const toUTC3Display = (iso) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() - 180) // UTC-3
  return d
}
const fmtD  = iso => toUTC3Display(iso).toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'2-digit'})
const fmtDT = iso => toUTC3Display(iso).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})


// ── Balance helpers ───────────────────────────────────────────────────────────
const accBal       = acc => Number(acc.balance||0)
const cliCreds     = (cid,credits) => { const b={}; credits.filter(r=>r.client_id===cid).forEach(r=>{b[r.currency]=(b[r.currency]||0)+Number(r.balance)}); return b }
const allCredByCur = credits => { const b={}; credits.filter(r=>Number(r.balance)>0).forEach(r=>{b[r.currency]=(b[r.currency]||0)+Number(r.balance)}); return b }
const allDebtsByCur = credits => { const b={}; credits.filter(r=>Number(r.balance)<0).forEach(r=>{b[r.currency]=(b[r.currency]||0)+Number(r.balance)}); return b }
const accSumByType = accounts => { const g={}; ACC_TYPES.forEach(t=>{g[t]={}}); accounts.forEach(a=>{const b=accBal(a); if(!g[a.type])g[a.type]={}; g[a.type][a.currency]=(g[a.type][a.currency]||0)+b}); return g }
const netWorth     = (accounts,credits) => { let t=accounts.reduce((s,a)=>s+toUSD(accBal(a),a.currency),0); credits.forEach(r=>{t+=toUSD(Number(r.balance),r.currency)}); return t }
const clientOps    = (cid,ops) => ops.filter(o=>o.clientId===cid&&!o.isReversal).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))

// ── Auto cotización ───────────────────────────────────────────────────────────
const calcRate = (fromAmt, fromCur, toAmt, toCur) => {
  const fa = parseFloat(fromAmt), ta = parseFloat(toAmt)
  if (!fa || !ta) return null
  // Rate = how many fromCur per 1 toCur (or vice versa for common pairs)
  // Common: PYG/USD → rate = PYG / USD
  if (toCur === 'USD' || toCur === 'USDT') return +(fa/ta).toFixed(2)
  if (fromCur === 'USD' || fromCur === 'USDT') return +(ta/fa).toFixed(2)
  return +(fa/ta).toFixed(6)
}

// ── Responsive ────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m,setM] = useState(window.innerWidth<768)
  useEffect(()=>{ const h=()=>setM(window.innerWidth<768); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h) },[])
  return m
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T={
  bg:'#161b22',bgApp:'#f6f8fa',bgCard:'#ffffff',
  border:'#d0d7de',borderDark:'#21262d',
  text:'#1f2328',textSub:'#636c76',textMuted:'#9198a1',
  green:'#1a7f37',greenBg:'#dafbe1',greenBorder:'#74c97f',
  red:'#cf222e',redBg:'#ffebe9',redBorder:'#ff8182',
  amber:'#9a6700',amberBg:'#fff8c5',amberBorder:'#d4a72c',
  blue:'#0969da',blueBg:'#ddf4ff',
  accent:'#2da44e',accentHover:'#2c974b',
  purple:'#8250df',purpleBg:'#fbefff',
}

// ── UI atoms ──────────────────────────────────────────────────────────────────
const Card = ({children,style,onClick}) => (
  <div onClick={onClick} style={{background:T.bgCard,border:'1px solid '+T.border,borderRadius:8,padding:'16px 20px',cursor:onClick?'pointer':undefined,...style}}>{children}</div>
)
const Btn = ({children,onClick,primary,small,disabled,danger,ghost,style}) => (
  <button onClick={onClick} disabled={disabled} style={{background:danger?T.redBg:primary?T.accent:ghost?'transparent':'#fff',color:danger?T.red:primary?'#fff':ghost?T.textSub:T.text,border:danger?'1px solid '+T.redBorder:primary?'none':ghost?'none':'1px solid '+T.border,borderRadius:6,padding:small?'4px 10px':'6px 14px',fontWeight:500,fontSize:small?11:13,fontFamily:"'DM Sans',sans-serif",cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,whiteSpace:'nowrap',letterSpacing:'-0.01em',...style}}>{children}</button>
)
const Tag = ({children,bg,color,size}) => (
  <span style={{display:'inline-flex',alignItems:'center',padding:size==='sm'?'1px 6px':'2px 8px',borderRadius:20,fontSize:size==='sm'?10:11,fontWeight:600,background:bg||T.bgApp,color:color||T.textSub,border:'1px solid '+T.border,whiteSpace:'nowrap'}}>{children}</span>
)
const Fld = ({label,children,hint}) => (
  <div style={{display:'flex',flexDirection:'column',gap:4}}>{label&&<label style={{fontSize:12,fontWeight:500,color:T.textSub}}>{label}</label>}{children}{hint&&<div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{hint}</div>}</div>
)
const Inp = ({label,hint,...p}) => (
  <Fld label={label} hint={hint}><input style={{background:'#fff',border:'1px solid '+T.border,borderRadius:6,padding:'6px 10px',width:'100%',fontSize:13,boxSizing:'border-box',color:T.text,outline:'none'}} {...p}/></Fld>
)
const Sel = ({label,children,...p}) => (
  <Fld label={label}><select style={{background:'#fff',border:'1px solid '+T.border,borderRadius:6,padding:'6px 10px',width:'100%',fontSize:13,boxSizing:'border-box',color:T.text}} {...p}>{children}</select></Fld>
)
const G2 = ({children,gap,stack}) => (
  <div style={{display:'grid',gridTemplateColumns:stack?'1fr':'1fr 1fr',gap:gap||12}}>{children}</div>
)
const Divider = () => <div style={{borderTop:'1px solid '+T.border,margin:'4px 0'}}/>
const TH_S = {padding:'10px 14px',textAlign:'left',fontWeight:600,fontSize:11,color:T.textSub,background:T.bgApp,textTransform:'uppercase',letterSpacing:'0.04em',whiteSpace:'nowrap',borderBottom:'1px solid '+T.border}
const TD_S = {padding:'11px 14px',borderBottom:'1px solid '+T.bgApp,fontSize:13,verticalAlign:'middle',color:T.text}

// ── Modal — slides up from center, not bottom ─────────────────────────────────
function Modal({open,onClose,title,children,wide}){
  if(!open) return null
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:'16px'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:10,padding:'20px',width:'100%',maxWidth:wide?680:540,maxHeight:'88vh',overflowY:'auto',border:`1px solid ${T.border}`,boxShadow:'0 8px 32px rgba(0,0,0,0.12)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999',lineHeight:1,padding:0}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function Confirm({open,onClose,onConfirm,message}){
  if(!open) return null
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:'min(360px,95vw)',border:`1px solid ${T.border}`,boxShadow:'0 8px 32px rgba(0,0,0,0.12)'}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>¿Confirmar eliminación?</div>
        <div style={{fontSize:13,color:'#666',marginBottom:20}}>{message||'Esta acción no se puede deshacer.'}</div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn danger onClick={()=>{onConfirm();onClose()}}>Eliminar</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Account search-select (replaces <select> for accounts) ───────────────────
function AccSearch({label, accounts, value, onChange}){
  const [q,setQ]     = useState('')
  const [open,setOpen] = useState(false)
  const selected     = accounts.find(a=>a.id===value)
  const filtered     = useMemo(()=>{
    const lower = q.toLowerCase()
    return accounts.filter(a=>
      a.name.toLowerCase().includes(lower) ||
      (a.titular||'').toLowerCase().includes(lower) ||
      a.currency.toLowerCase().includes(lower) ||
      a.type.toLowerCase().includes(lower)
    ).slice(0,12)
  },[accounts,q])

  return (
    <Fld label={label}>
      <div style={{position:'relative'}}>
        <div
          onClick={()=>setOpen(o=>!o)}
          style={{background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,padding:'8px 12px',fontSize:13,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',userSelect:'none'}}
        >
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {selected?`${selected.name} (${selected.currency})`:'Seleccionar cuenta...'}
          </span>
          <span style={{fontSize:10,color:T.textMuted,marginLeft:6}}>{open?'▲':'▼'}</span>
        </div>
        {open&&(
          <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden'}}>
            <div style={{padding:'6px 8px',borderBottom:'1px solid '+T.border}}>
              <input
                autoFocus
                placeholder="Buscar cuenta..."
                value={q}
                onChange={e=>setQ(e.target.value)}
                onClick={e=>e.stopPropagation()}
                style={{width:'100%',border:'none',outline:'none',fontSize:13,background:'transparent'}}
              />
            </div>
            <div style={{maxHeight:200,overflowY:'auto'}}>
              {filtered.length===0
                ?<div style={{padding:'10px 12px',fontSize:12,color:T.textMuted}}>Sin resultados</div>
                :filtered.map(a=>(
                  <div
                    key={a.id}
                    onClick={()=>{onChange(a.id);setOpen(false);setQ('')}}
                    style={{padding:'8px 12px',cursor:'pointer',background:a.id===value?'#f0f0ea':'transparent',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8f8f4'}
                    onMouseLeave={e=>e.currentTarget.style.background=a.id===value?'#f0f0ea':'transparent'}
                  >
                    <div>
                      <div style={{fontSize:13,fontWeight:a.id===value?600:400}}>{a.name}</div>
                      <div style={{fontSize:10,color:T.textMuted}}>{a.type}{a.titular?' · '+a.titular:''}</div>
                    </div>
                    <Tag bg={ACC_COLOR[a.type]||'#f0f0ea'}>{a.currency}</Tag>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </Fld>
  )
}

// ── Client search-select with inline create ────────────────────────────────
function ClientSearch({label, clients, value, onChange, onCreateClient, optional}){
  const [q,setQ]       = useState('')
  const [open,setOpen] = useState(false)
  const [creating,setCreating] = useState(false)
  const [newName,setNewName]   = useState('')
  const selected = clients.find(c=>c.id===value)
  const filtered = useMemo(()=>{
    const lower=q.toLowerCase()
    return clients.filter(c=>c.name.toLowerCase().includes(lower)).slice(0,10)
  },[clients,q])

  const doCreate = () => {
    if(!newName.trim()) return
    onCreateClient(newName.trim(), id => { onChange(id); setOpen(false); setQ(''); setCreating(false); setNewName('') })
  }

  return (
    <Fld label={label}>
      <div style={{position:'relative'}}>
        <div onClick={()=>setOpen(o=>!o)} style={{background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,padding:'8px 12px',fontSize:13,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',userSelect:'none'}}>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:selected?'#0f0f0f':'#aaa'}}>
            {selected?selected.name:(optional?'— Sin cliente —':'Seleccionar...')}
          </span>
          <span style={{fontSize:10,color:T.textMuted,marginLeft:6}}>{open?'▲':'▼'}</span>
        </div>
        {open&&(
          <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden'}}>
            <div style={{padding:'6px 8px',borderBottom:'1px solid '+T.border}}>
              <input autoFocus placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)} onClick={e=>e.stopPropagation()} style={{width:'100%',border:'none',outline:'none',fontSize:13,background:'transparent'}}/>
            </div>
            <div style={{maxHeight:180,overflowY:'auto'}}>
              {optional&&<div onClick={()=>{onChange('');setOpen(false);setQ('')}} style={{padding:'8px 12px',cursor:'pointer',fontSize:13,color:T.textMuted,borderBottom:'1px solid #f5f5f4'}} onMouseEnter={e=>e.currentTarget.style.background='#f8f8f4'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>— Sin cliente —</div>}
              {filtered.length===0&&!creating&&<div style={{padding:'8px 12px',fontSize:12,color:T.textMuted}}>Sin resultados</div>}
              {filtered.map(c=>(
                <div key={c.id} onClick={()=>{onChange(c.id);setOpen(false);setQ('')}} style={{padding:'8px 12px',cursor:'pointer',background:c.id===value?'#f0f0ea':'transparent',fontSize:13,fontWeight:c.id===value?600:400}} onMouseEnter={e=>e.currentTarget.style.background='#f8f8f4'} onMouseLeave={e=>e.currentTarget.style.background=c.id===value?'#f0f0ea':'transparent'}>
                  {c.name}
                </div>
              ))}
            </div>
            {/* Create new */}
            <div style={{borderTop:'1px solid #f0f0ea'}}>
              {creating
                ?<div style={{padding:'8px 10px',display:'flex',gap:6,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
                  <input autoFocus placeholder="Nombre del cliente..." value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doCreate()} style={{flex:1,border:'1.5px solid #e0e0da',borderRadius:8,padding:'5px 8px',fontSize:12,outline:'none'}}/>
                  <button onClick={doCreate} style={{background:T.bg,color:'#fff',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:"'Syne',sans-serif",whiteSpace:'nowrap'}}>Crear</button>
                  <button onClick={()=>{setCreating(false);setNewName('')}} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted,fontSize:16,padding:'2px 4px'}}>×</button>
                </div>
                :<div onClick={e=>{e.stopPropagation();setCreating(true)}} style={{padding:'9px 12px',cursor:'pointer',fontSize:12,fontWeight:700,color:T.text,display:'flex',alignItems:'center',gap:6}} onMouseEnter={e=>e.currentTarget.style.background='#f0f0ea'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <span style={{fontSize:16,lineHeight:1}}>+</span> Crear nuevo cliente
                </div>
              }
            </div>
          </div>
        )}
      </div>
    </Fld>
  )
}

// ── Op Form ───────────────────────────────────────────────────────────────────
// ── Leg row components (defined at module level to avoid focus loss) ───────────
function AccRow({leg, idx, side, accounts, onAccChange, onAmtChange, onRemove}) {
  return (
    <div style={{display:'flex',gap:8,alignItems:'flex-end',padding:'8px',background:side==='out'?'#fff5f5':'#f0fdf4',borderRadius:8,marginBottom:6}}>
      <div style={{flex:2}}>
        <AccSearch
          label={idx===0?(side==='out'?'Cuenta origen':'Cuenta destino'):''}
          accounts={accounts} value={leg.accId}
          onChange={v=>onAccChange(idx,v)}
        />
      </div>
      <div style={{flex:1}}>
        <Inp
          label={idx===0?'Monto':''}
          type="number" placeholder="0.00"
          value={leg.amt}
          onChange={e=>onAmtChange(idx,e.target.value)}
        />
      </div>
      {onRemove&&<button onClick={()=>onRemove(idx)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted,fontSize:18,paddingBottom:4,flexShrink:0}}>×</button>}
      {!onRemove&&<div style={{width:22,flexShrink:0}}/>}
    </div>
  )
}

function CredRow({leg, idx, onAmtChange, onCurChange, onRemove}) {
  return (
    <div style={{display:'flex',gap:8,alignItems:'flex-end',padding:'8px',background:'#fffbeb',borderRadius:8,marginBottom:6}}>
      <div style={{flex:1}}>
        <Inp label={idx===0?'Monto crédito':''} type="number" placeholder="0.00" value={leg.amt} onChange={e=>onAmtChange(idx,e.target.value)}/>
      </div>
      <div style={{width:110,flexShrink:0}}>
        <Sel label={idx===0?'Moneda':''} value={leg.cur||'USD'} onChange={e=>onCurChange(idx,e.target.value)}>
          {CURRENCIES.map(c=><option key={c}>{c}</option>)}
        </Sel>
      </div>
      <button onClick={()=>onRemove(idx)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted,fontSize:18,paddingBottom:4,flexShrink:0}}>×</button>
    </div>
  )
}

// Credit-deduction row: reduces an existing credit balance (they pay us via credit discount)
function CreditDeductRow({leg, idx, clients, credits, onClientChange, onAmtChange, onCurChange, onRemove}) {
  const clientBals = leg.clientId ? cliCreds(leg.clientId, credits) : {}
  const availCurs  = Object.entries(clientBals).filter(([,v])=>v>0).map(([c])=>c)
  return (
    <div style={{border:'1px solid #fcd34d',borderRadius:8,padding:'8px 10px',marginBottom:6,background:'#fffbeb'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,fontWeight:700,color:'#b45309',textTransform:'uppercase',letterSpacing:'0.04em'}}>💳 Descuento de deuda del cliente</span>
        <button onClick={()=>onRemove(idx)} style={{background:'none',border:'none',cursor:'pointer',color:T.textMuted,fontSize:16}}>×</button>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <div style={{flex:2,minWidth:120}}>
          <Fld label="Cliente">
            <select value={leg.clientId||''} onChange={e=>onClientChange(idx,e.target.value)} style={{background:'#fff',border:'1px solid '+T.border,borderRadius:6,padding:'6px 10px',width:'100%',fontSize:13,color:T.text}}>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Fld>
        </div>
        <div style={{flex:1,minWidth:80}}>
          <Inp label="Monto a descontar" type="number" placeholder="0.00" value={leg.amt} onChange={e=>onAmtChange(idx,e.target.value)}/>
        </div>
        <div style={{width:90,flexShrink:0}}>
          <Sel label="Moneda" value={leg.cur||'USD'} onChange={e=>onCurChange(idx,e.target.value)}>
            {(availCurs.length>0?availCurs:CURRENCIES).map(c=><option key={c}>{c}</option>)}
          </Sel>
        </div>
      </div>
      {leg.clientId&&Object.keys(clientBals).length>0&&(
        <div style={{marginTop:6,fontSize:11,color:'#b45309'}}>
          Saldo disponible: {Object.entries(clientBals).filter(([,v])=>v>0).map(([c,v])=>fmt(v,c)).join(' · ')}
        </div>
      )}
    </div>
  )
}

function OpForm({accounts,clients,credits,onSubmit,onClose,onCreateClient,editOp}){
  const mobile = useIsMobile()
  const [mode,setMode] = useState(editOp?.mode||'exchange')

  // Multi-leg state: outs = legs that leave our accounts/create debt
  //                  ins  = legs that enter our accounts/cancel debt
  const mkOut  = () => ({id:uid(), kind:'account', accId:accounts.find(a=>a.currency==='USDT')?.id||accounts[0]?.id, amt:''})
  const mkIn   = () => ({id:uid(), kind:'account', accId:accounts.find(a=>a.currency==='USD'&&a.type==='Efectivo')?.id||accounts[0]?.id, amt:''})
  const mkCred = () => ({id:uid(), kind:'credit',  cur:'USD', amt:''})
  const mkDebt = () => ({id:uid(), kind:'debt_deduct', clientId:clients[0]?.id||'', cur:'USD', amt:''})

  const initState = () => {
    if(editOp){
      const outLegs = editOp.legs?.filter(l=>l.delta<0)||[]
      const inLegs  = editOp.legs?.filter(l=>l.delta>0)||[]
      return {
        date: editOp.createdAt.slice(0,16),
        clientId: editOp.clientId||'',
        detail: editOp.detail||'',
        rate: editOp.rate?String(editOp.rate):'',
        outs: outLegs.map(l=>({id:uid(), kind:l.kind, accId:l.accId||'', cur:l.cur, amt:String(Math.abs(l.delta))})),
        ins:  inLegs.map(l=>({id:uid(), kind:l.kind, accId:l.accId||'', cur:l.cur, clientId:l.clientId||'', clientName:l.clientName||'', amt:String(l.delta)})),
      }
    }
    return {
      date: nowUTC3(),
      clientId: clients[0]?.id||'',
      detail: '',
      rate: '',
      files: [],
      outs: [mkOut()],
      ins:  [mkIn()],
    }
  }

  const [s,setS] = useState(initState)
  const set = (k,v) => setS(x=>({...x,[k]:v}))

  const setOut = (idx,k,v) => setS(x=>({...x, outs:x.outs.map((o,i)=>i===idx?{...o,[k]:v}:o)}))
  const setIn  = (idx,k,v) => setS(x=>({...x, ins:x.ins.map((o,i)=>i===idx?{...o,[k]:v}:o)}))
  const addOut = () => setS(x=>({...x, outs:[...x.outs, mkOut()]}))
  const addIn  = () => setS(x=>({...x, ins:[...x.ins, mkIn()]}))
  const addInCred = () => setS(x=>({...x, ins:[...x.ins, mkCred()]}))
  const addInDebt = () => setS(x=>({...x, outs:[...x.outs, mkDebt()]}))
  const rmOut  = (idx) => setS(x=>({...x, outs:x.outs.filter((_,i)=>i!==idx)}))
  const rmIn   = (idx) => setS(x=>({...x, ins:x.ins.filter((_,i)=>i!==idx)}))

  const client = clients.find(c=>c.id===s.clientId)
  const existCreds = useMemo(()=>s.clientId?cliCreds(s.clientId,credits):{},[s.clientId,credits])

  // Total out in USD / total in in USD for profit
  const totalOutUSD = useMemo(()=>s.outs.reduce((sum,o)=>{
    const a=parseFloat(o.amt)||0
    const acc=accounts.find(x=>x.id===o.accId)
    return sum+toUSD(a,acc?.currency||'USD')
  },0),[s.outs,accounts])

  const totalInUSD = useMemo(()=>s.ins.reduce((sum,o)=>{
    const a=parseFloat(o.amt)||0
    const cur=o.kind==='credit'?o.cur:(accounts.find(x=>x.id===o.accId)?.currency||'USD')
    return sum+toUSD(a,cur)
  },0),[s.ins,accounts])

  const autoProfit = useMemo(()=>{
    if(mode==='transfer') return null
    if(!totalOutUSD&&!totalInUSD) return null
    return +(totalInUSD-totalOutUSD).toFixed(2)
  },[totalOutUSD,totalInUSD,mode])

  const submit = async () => {
    const legs = []
    for(const o of s.outs){
      const amt=parseFloat(o.amt)||0
      if(!amt) continue
      if(o.kind==='account'){
        const acc=accounts.find(x=>x.id===o.accId)
        legs.push({id:uid(),kind:'account',accId:o.accId,cur:acc?.currency,delta:-amt})
      } else if(o.kind==='debt_deduct'){
        // Reduces the client's credit balance (they "pay" via credit discount)
        const cli=clients.find(c=>c.id===o.clientId)
        legs.push({id:uid(),kind:'credit',clientId:o.clientId,clientName:cli?.name,cur:o.cur,delta:-amt})
      }
    }
    for(const o of s.ins){
      const amt=parseFloat(o.amt)||0
      if(!amt) continue
      if(o.kind==='account'){
        const acc=accounts.find(x=>x.id===o.accId)
        legs.push({id:uid(),kind:'account',accId:o.accId,cur:acc?.currency,delta:amt})
      } else if(o.kind==='credit'){
        const cli=clients.find(c=>c.id===s.clientId)
        legs.push({id:uid(),kind:'credit',clientId:s.clientId,clientName:cli?.name,cur:o.cur,delta:amt})
      }
    }
    if(!legs.length){alert('Agregá al menos un movimiento');return}
    const opId = editOp?editOp.id:uid()
    // Upload new files
    let attachments = editOp?.attachments||[]
    if(s.files&&s.files.length>0){
      for(const file of s.files){
        try{
          const path = await uploadAttachment(file, opId)
          attachments = [...attachments, {path, name:file.name, size:file.size}]
        }catch(e){ console.warn('Upload failed:',e.message) }
      }
    }
    onSubmit({
      id:opId,
      createdAt:new Date(s.date).toISOString(),
      detail:s.detail, mode,
      clientId:s.clientId||null, clientName:clients.find(c=>c.id===s.clientId)?.name||null,
      rate:parseFloat(s.rate)||null, profit:autoProfit, legs, attachments
    },editOp)
    onClose()
  }

  const MODES = [
    {k:'exchange',  icon:'⇄', label:'Cambio',       desc:'Pago en el momento'},
    {k:'credit_out',icon:'📤',label:'Crédito dado',  desc:'Te queda debiendo'},
    {k:'credit_in', icon:'📥',label:'Cobro deuda',   desc:'Salda su deuda'},
    {k:'debt_in',   icon:'📨',label:'Deuda tomada',  desc:'Recibís, quedás debiendo'},
    {k:'debt_pay',  icon:'💸',label:'Pago deuda',    desc:'Pagás lo que debés'},
    {k:'transfer',  icon:'↔', label:'Transferencia', desc:'Entre tus cuentas'},
  ]


  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Mode selector */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
        {MODES.map(m=>(
          <button key={m.k} onClick={()=>setMode(m.k)} style={{background:mode===m.k?T.text:'#f8f8f4',color:mode===m.k?'#fff':T.textSub,border:'1px solid '+(mode===m.k?T.text:T.border),borderRadius:8,padding:'8px 10px',cursor:'pointer',textAlign:'left',transition:'all .1s'}}>
            <div style={{fontSize:14,marginBottom:1}}>{m.icon}</div>
            <div style={{fontWeight:600,fontSize:11}}>{m.label}</div>
            <div style={{fontSize:10,opacity:.6}}>{m.desc}</div>
          </button>
        ))}
      </div>
      <Divider/>

      <Inp label="Fecha y hora" type="datetime-local" value={s.date} onChange={e=>set('date',e.target.value)}/>

      {/* Client selector (most modes need it) */}
      {mode!=='transfer'&&(
        <ClientSearch
          label={mode==='exchange'?'Cliente contraparte (opcional)':'Cliente / Corresponsal'}
          clients={clients} value={s.clientId}
          onChange={v=>set('clientId',v)}
          onCreateClient={onCreateClient}
          optional={mode==='exchange'}
        />
      )}

      {/* Show existing positions for this client */}
      {s.clientId&&(Object.entries(existCreds).some(([,v])=>v!==0))&&(
        <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'8px 12px',fontSize:12}}>
          <div style={{fontWeight:600,marginBottom:4,color:'#b45309'}}>Posición actual con {client?.name}:</div>
          {Object.entries(existCreds).filter(([,v])=>v!==0).map(([c,v])=>(
            <div key={c} style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:T.textSub}}>{c}</span>
              <span style={{fontWeight:600,color:v>0?'#b45309':'#be123c'}}>{v>0?'+':''}{fmt(v,c)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── SALIDAS ── */}
      <div style={{background:'#fff5f5',border:'1px solid #fecaca',borderRadius:10,padding:'10px 12px'}}>
        <div style={{fontSize:11,fontWeight:600,color:T.red,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>
          📤 Sale / se descuenta
        </div>
        {s.outs.map((leg,idx)=>(
          leg.kind==='debt_deduct'
            ? <CreditDeductRow
                key={leg.id} leg={leg} idx={idx}
                clients={clients} credits={credits}
                onClientChange={(i,v)=>setOut(i,'clientId',v)}
                onAmtChange={(i,v)=>setOut(i,'amt',v)}
                onCurChange={(i,v)=>setOut(i,'cur',v)}
                onRemove={rmOut}
              />
            : <AccRow
                key={leg.id} leg={leg} idx={idx} side="out"
                accounts={accounts}
                onAccChange={(i,v)=>setOut(i,'accId',v)}
                onAmtChange={(i,v)=>setOut(i,'amt',v)}
                onRemove={idx>0?rmOut:null}
              />
        ))}
        <div style={{display:'flex',gap:6,marginTop:2}}>
          <button onClick={addOut} style={{flex:1,background:'none',border:'1px dashed '+T.red,borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:T.red}}>
            + Cuenta
          </button>
          {mode!=='transfer'&&(
            <button onClick={addInDebt} style={{flex:1,background:'none',border:'1px dashed #b45309',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:'#b45309'}}>
              + Descuento de deuda
            </button>
          )}
        </div>
      </div>

      {/* ── ENTRADAS ── */}
      <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'10px 12px'}}>
        <div style={{fontSize:11,fontWeight:600,color:T.green,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.04em'}}>
          📥 Entra a tus cuentas
        </div>
        {s.ins.map((leg,idx)=>(
          leg.kind==='account'
            ? <AccRow
                key={leg.id} leg={leg} idx={idx} side="in"
                accounts={accounts}
                onAccChange={(i,v)=>setIn(i,'accId',v)}
                onAmtChange={(i,v)=>setIn(i,'amt',v)}
                onRemove={idx>0?rmIn:null}
              />
            : <CredRow
                key={leg.id} leg={leg} idx={idx}
                onAmtChange={(i,v)=>setIn(i,'amt',v)}
                onCurChange={(i,v)=>setIn(i,'cur',v)}
                onRemove={rmIn}
              />
        ))}
        <div style={{display:'flex',gap:6,marginTop:2}}>
          <button onClick={addIn} style={{flex:1,background:'none',border:'1px dashed '+T.green,borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:T.green}}>
            + Cuenta interna
          </button>
          {mode!=='transfer'&&(
            <button onClick={addInCred} style={{flex:1,background:'none',border:'1px dashed #b45309',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:12,color:'#b45309'}}>
              + Crédito / deuda
            </button>
          )}
        </div>
      </div>

      {/* Totals summary */}
      {(totalOutUSD>0||totalInUSD>0)&&(
        <div style={{background:T.bgApp,border:'1px solid '+T.border,borderRadius:8,padding:'10px 12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,color:T.textSub}}>Total salida (USD equiv.)</span>
            <span style={{fontSize:13,fontWeight:600,color:T.red}}>{fmt(totalOutUSD,'USD')}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,color:T.textSub}}>Total entrada (USD equiv.)</span>
            <span style={{fontSize:13,fontWeight:600,color:T.green}}>{fmt(totalInUSD,'USD')}</span>
          </div>
          {autoProfit!==null&&<>
            <div style={{borderTop:'1px solid '+T.border,marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:600,color:T.textSub}}>Profit / Loss</span>
              <span style={{fontSize:16,fontWeight:700,color:autoProfit>=0?T.green:T.red}}>{(autoProfit>=0?'+':'')+fmt(autoProfit,'USD')}</span>
            </div>
          </>}
        </div>
      )}

      <Inp label="Cotización de referencia (opcional)" type="number" placeholder="ej: 6200" value={s.rate} onChange={e=>set('rate',e.target.value)}/>
      <Inp label="Detalle / Comentario" placeholder="Descripción de la operación" value={s.detail} onChange={e=>set('detail',e.target.value)}/>

      {/* Attachment upload */}
      <Fld label="Comprobantes (opcional)">
        <div style={{border:'1px dashed '+T.border,borderRadius:8,padding:'10px 12px',background:T.bgApp}}>
          <input
            type="file" multiple accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={e=>set('files',Array.from(e.target.files))}
            style={{fontSize:12,color:T.textSub,width:'100%'}}
          />
          {s.files&&s.files.length>0&&(
            <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:4}}>
              {s.files.map((f,i)=>(
                <Tag key={i} bg={T.blueBg} color={T.blue} size="sm">📎 {f.name.slice(0,20)}{f.name.length>20?'…':''}</Tag>
              ))}
            </div>
          )}
          {/* Show existing attachments when editing */}
          {editOp?.attachments?.length>0&&(
            <div style={{marginTop:6}}>
              <div style={{fontSize:11,color:T.textMuted,marginBottom:4}}>Archivos existentes:</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {editOp.attachments.map((a,i)=>(
                  <Tag key={i} bg={T.greenBg} color={T.green} size="sm">✓ {a.name||'archivo '+(i+1)}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </Fld>

      <div style={{fontSize:10,color:T.textMuted,textAlign:'center'}}>Ref: 1 USDT=$1 · 1 EUR=$1.08 · ₲6200=$1 · R$5.1=$1</div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:4}}>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn primary onClick={submit}>{editOp?'Guardar cambios':'Registrar'}</Btn>
      </div>
    </div>
  )
}

// ── Account Detail ────────────────────────────────────────────────────────────
function AccDetail({acc,ops,onUpdateAcc}){
  const [editOB,setEditOB] = useState(false)
  const [newOB,setNewOB]   = useState(String(acc.opening_bal||0))
  const accOps = useMemo(()=>{
    const rows=[]
    ops.filter(o=>!o.isReversal).forEach(o=>{
      (o.legs||[]).filter(l=>l.kind==='account'&&l.accId===acc.id).forEach(l=>rows.push({id:l.id,date:o.createdAt,detail:o.detail,delta:l.delta,clientName:o.clientName,mode:o.mode}))
    })
    return rows.sort((a,b)=>new Date(a.date)-new Date(b.date))
  },[ops,acc.id])
  const modeLab = {exchange:'Cambio',credit_out:'Crédito',credit_in:'Cobro',debt_in:'Deuda tomada',debt_pay:'Pago deuda',transfer:'Transfer.'}
  let running = Number(acc.opening_bal||0)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
        <div style={{background:ACC_COLOR[acc.type]||'#f0f0ea',borderRadius:12,padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{acc.type}</div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",wordBreak:'break-all'}}>{fmt(accBal(acc),acc.currency)}</div>
          <div style={{fontSize:11,marginTop:3,opacity:.7}}>{acc.currency}{acc.titular?' · '+acc.titular:''}</div>
        </div>
        <div style={{background:T.bgApp,borderRadius:12,padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,color:T.textSub}}>Saldo inicial</div>
          {editOB
            ?<div style={{display:'flex',gap:6,alignItems:'center'}}><input type="number" value={newOB} onChange={e=>setNewOB(e.target.value)} style={{width:90,padding:'4px 8px',borderRadius:8,border:'1.5px solid #ccc',fontSize:13}}/><Btn primary small onClick={()=>{onUpdateAcc(acc.id,parseFloat(newOB)||0);setEditOB(false)}}>✓</Btn><Btn small onClick={()=>setEditOB(false)}>✕</Btn></div>
            :<div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><div style={{fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif",wordBreak:'break-all'}}>{fmt(acc.opening_bal||0,acc.currency)}</div><Btn small onClick={()=>setEditOB(true)}>✏</Btn></div>
          }
        </div>
      </div>
      <div style={{overflowX:'auto',borderRadius:12,border:'1.5px solid #e8e8e2'}}>
        <table style={{borderCollapse:'collapse',width:'100%',minWidth:380}}>
          <thead><tr>{['Fecha','Tipo','Detalle','Movimiento','Balance'].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
          <tbody>
            <tr style={{background:'#fafaf8'}}><td style={{...TD_S,fontSize:10,color:T.textMuted}}>—</td><td style={TD_S}><Tag>Inicial</Tag></td><td style={TD_S}>Saldo inicial</td><td style={{...TD_S,fontWeight:700,color:T.textSub}}>{fmt(acc.opening_bal||0,acc.currency)}</td><td style={{...TD_S,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(acc.opening_bal||0,acc.currency)}</td></tr>
            {accOps.length===0
              ?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:T.textMuted}}>Sin movimientos aún</td></tr>
              :accOps.map(row=>{ running+=row.delta; const snap=running; return (
                <tr key={row.id}>
                  <td style={{...TD_S,fontSize:10,color:T.textMuted,whiteSpace:'nowrap'}}>{fmtDT(row.date)}</td>
                  <td style={TD_S}><Tag>{modeLab[row.mode]||'—'}</Tag></td>
                  <td style={{...TD_S,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.detail||'—'}{row.clientName&&<span style={{display:'block',fontSize:10,background:cliColor(row.clientName),padding:'0 5px',borderRadius:8,marginTop:2,width:'fit-content'}}>{row.clientName}</span>}</td>
                  <td style={{...TD_S,fontWeight:700,color:row.delta>=0?'#16a34a':'#dc2626',whiteSpace:'nowrap'}}>{(row.delta>=0?'+':'')+fmt(row.delta,acc.currency)}</td>
                  <td style={{...TD_S,fontWeight:800,fontFamily:"'Syne',sans-serif",color:snap<0?'#dc2626':'#0f0f0f',whiteSpace:'nowrap'}}>{fmt(snap,acc.currency)}</td>
                </tr>
              )})
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sidebar / Bottom nav ──────────────────────────────────────────────────────
const TABS   = ['Dashboard','Operaciones','Clientes','Cuentas','Reportes']
const T_ICON = {Dashboard:'🏠',Operaciones:'↕',Clientes:'👥',Cuentas:'🏦',Reportes:'📊'}
const T_COL  = {Dashboard:'#fde047',Operaciones:'#f9a8d4',Clientes:'#93c5fd',Cuentas:'#86efac',Reportes:'#c4b5fd'}

function Sidebar({tab,setTab,profile,signOut,mobile}){
  const navItem = (t) => (
    <button key={t} onClick={()=>setTab(t)} style={{
      background:tab===t?'rgba(45,164,78,0.15)':'transparent',
      color:tab===t?'#2da44e':'#8b949e',
      border:'none', borderRadius:6, padding:'8px 12px', cursor:'pointer',
      textAlign:'left', fontWeight:tab===t?600:400, fontSize:13,
      fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:10,
      transition:'all .15s', width:'100%',
    }}>
      <span style={{fontSize:16,width:20,textAlign:'center'}}>{T_ICON[t]}</span>
      {t}
    </button>
  )
  if(mobile) return (
    <>
      <div style={{position:'sticky',top:0,background:T.bg,zIndex:100,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,borderBottom:`1px solid ${T.borderDark}`}}>
        <div style={{fontWeight:700,fontSize:14,color:'#e6edf3',letterSpacing:'-0.02em'}}>SATO <span style={{color:T.accent}}>Treasury</span></div>
        <button onClick={signOut} style={{background:'none',border:`1px solid ${T.borderDark}`,borderRadius:6,padding:'4px 10px',color:'#8b949e',cursor:'pointer',fontSize:11}}>Salir</button>
      </div>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:T.bg,display:'flex',zIndex:200,borderTop:`1px solid ${T.borderDark}`}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,background:'transparent',color:tab===t?T.accent:'#8b949e',border:'none',padding:'8px 0 6px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,borderTop:tab===t?`2px solid ${T.accent}`:'2px solid transparent'}}>
            <span style={{fontSize:16}}>{T_ICON[t]}</span>
            <span style={{fontSize:9,fontWeight:tab===t?600:400}}>{t}</span>
          </button>
        ))}
      </div>
    </>
  )
  return (
    <div style={{width:200,minWidth:200,background:T.bg,display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh',flexShrink:0,borderRight:`1px solid ${T.borderDark}`}}>
      {/* Logo */}
      <div style={{padding:'20px 16px 16px',borderBottom:`1px solid ${T.borderDark}`}}>
        <div style={{fontWeight:700,fontSize:16,color:'#e6edf3',letterSpacing:'-0.02em',display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,background:T.accent,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>₿</div>
          <span>SATO <span style={{color:T.accent}}>Treasury</span></span>
        </div>
      </div>
      {/* Nav */}
      <nav style={{display:'flex',flexDirection:'column',gap:1,padding:'12px 8px',flex:1}}>
        {TABS.map(t=>navItem(t))}
      </nav>
      {/* User */}
      <div style={{padding:'12px 16px',borderTop:`1px solid ${T.borderDark}`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'#21262d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#e6edf3'}}>{(profile?.name||'U').slice(0,1).toUpperCase()}</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,color:'#e6edf3',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name}</div>
            <div style={{fontSize:10,color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.04em'}}>{profile?.role}</div>
          </div>
        </div>
        <button onClick={signOut} style={{background:'none',border:`1px solid ${T.borderDark}`,borderRadius:6,padding:'5px 10px',color:'#8b949e',cursor:'pointer',fontSize:11,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
          ↪ Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({accounts,clients,ops,credits,setTab}){
  const mobile = useIsMobile()
  const d=new Date(),visOps=ops.filter(o=>!o.isReversal)
  const pf=f=>visOps.filter(f).reduce((s,o)=>s+(o.profit||0),0)
  const today=pf(o=>new Date(o.createdAt).toDateString()===d.toDateString())
  const month=pf(o=>{const td=new Date(o.createdAt);return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear()})
  const recent=[...visOps].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5)
  const nw=useMemo(()=>netWorth(accounts,credits),[accounts,credits])
  const myUSD=useMemo(()=>accounts.reduce((s,a)=>s+toUSD(accBal(a),a.currency),0),[accounts])
  const crUSD=useMemo(()=>credits.reduce((s,r)=>s+toUSD(Number(r.balance),r.currency),0),[credits])
  const credSumm=useMemo(()=>{const r=[];clients.forEach(c=>{const b=cliCreds(c.id,credits);const d=Object.entries(b).filter(([,v])=>v>0);if(d.length>0)r.push({c,debts:d,type:'credit'})});return r},[clients,credits])
  const debtSumm=useMemo(()=>{const r=[];clients.forEach(c=>{const b=cliCreds(c.id,credits);const d=Object.entries(b).filter(([,v])=>v<0);if(d.length>0)r.push({c,debts:d,type:'debt'})});return r},[clients,credits])
  const accSumm=useMemo(()=>accSumByType(accounts),[accounts])
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',debt_in:'Deuda tomada',debt_pay:'Pago deuda',transfer:'Transfer.'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.textMuted,letterSpacing:'0.04em',textTransform:'uppercase',marginBottom:4}}>Panel principal</div>
          <h1 style={{fontWeight:700,fontSize:mobile?20:24,color:T.text,letterSpacing:'-0.02em'}}>Buenos días 👋</h1>
          <p style={{color:T.textMuted,fontSize:13,marginTop:2}}>{visOps.length} operaciones · {clients.length} clientes activos</p>
        </div>
      </div>

      {/* Balance banner */}
      <div style={{background:T.bg,borderRadius:10,padding:mobile?'18px':'22px 28px',color:'#e6edf3',display:'flex',flexWrap:'wrap',gap:24,alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:160}}>
          <div style={{fontSize:11,fontWeight:600,color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Patrimonio neto (USD)</div>
          <div style={{fontSize:mobile?26:36,fontWeight:700,letterSpacing:'-0.03em',color:nw>=0?'#3fb950':'#f85149',lineHeight:1}}>{(nw>=0?'+':'')+fmt(nw,'USD')}</div>
        </div>
        <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
          <div style={{borderLeft:`1px solid #30363d`,paddingLeft:24}}>
            <div style={{fontSize:11,color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>Mis cuentas</div>
            <div style={{fontSize:16,fontWeight:600,color:'#79c0ff'}}>{fmt(myUSD,'USD')}</div>
          </div>
          <div style={{borderLeft:`1px solid #30363d`,paddingLeft:24}}>
            <div style={{fontSize:11,color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>Posiciones netas</div>
            <div style={{fontSize:16,fontWeight:600,color:crUSD>=0?'#56d364':'#f85149'}}>{(crUSD>=0?'+':'')+fmt(crUSD,'USD')}</div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>
        {[
          {l:'Ganancia hoy',v:fmt(today,'USD'),pos:today>=0,icon:'📈'},
          {l:'Ganancia mes',v:fmt(month,'USD'),pos:month>=0,icon:'📅'},
          {l:'Me deben',v:credSumm.length+' contraparte'+(credSumm.length!==1?'s':''),pos:true,icon:'🟡'},
          {l:'Les debo',v:debtSumm.length+' contraparte'+(debtSumm.length!==1?'s':''),pos:debtSumm.length===0,icon:'🔴'},
        ].map(({l,v,pos,icon})=>(
          <Card key={l} style={{padding:'14px 16px'}}>
            <div style={{fontSize:18,marginBottom:8}}>{icon}</div>
            <div style={{fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:4}}>{l}</div>
            <div style={{fontSize:mobile?14:16,fontWeight:700,color:T.text}}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:14}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Saldos por tipo</div>
          {ACC_TYPES.map(type=>{
            const ent=Object.entries(accSumm[type]||{}).filter(([,v])=>v!==0)
            return (
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc',flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span>
                </div>
                {ent.length===0
                  ?<div style={{fontSize:11,color:T.textMuted,paddingLeft:13}}>$0</div>
                  :ent.map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'1px 0 1px 10px',borderLeft:'2px solid '+(ACC_COLOR[type]||'#eee')}}>
                      <span style={{fontSize:12,color:T.textSub}}>{cur}</span>
                      <span style={{fontSize:13,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Posiciones abiertas</div>
          {credSumm.length===0&&debtSumm.length===0
            ?<div style={{textAlign:'center',padding:'12px 0'}}><div style={{fontSize:22}}>✓</div><div style={{fontSize:12,color:T.textSub,marginTop:4}}>Sin posiciones abiertas</div></div>
            :<>
              {credSumm.length>0&&<>
                <div style={{fontSize:10,fontWeight:700,color:'#b45309',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Me deben →</div>
                {credSumm.map(({c,debts})=>(
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',marginBottom:4,background:'#fffbeb',borderRadius:10,border:'1px solid #fcd34d'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:cliColor(c.name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{c.name.slice(0,2)}</div>
                      <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                      {debts.map(([cur,v])=><div key={cur} style={{fontSize:12,fontWeight:700,color:'#b45309'}}>{fmt(v,cur)}</div>)}
                    </div>
                  </div>
                ))}
              </>}
              {debtSumm.length>0&&<>
                <div style={{fontSize:10,fontWeight:700,color:'#be123c',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6,marginTop:credSumm.length>0?10:0}}>← Les debo</div>
                {debtSumm.map(({c,debts})=>(
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',marginBottom:4,background:'#fff1f2',borderRadius:10,border:'1px solid #fda4af'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:cliColor(c.name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{c.name.slice(0,2)}</div>
                      <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                      {debts.map(([cur,v])=><div key={cur} style={{fontSize:12,fontWeight:700,color:'#be123c'}}>{fmt(Math.abs(v),cur)}</div>)}
                    </div>
                  </div>
                ))}
              </>}
            </>
          }
        </Card>
      </div>

      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em'}}>Últimas operaciones</div>
          <Btn small onClick={()=>setTab('Operaciones')}>Ver todas →</Btn>
        </div>
        {recent.length===0
          ?<div style={{fontSize:12,color:T.textMuted,textAlign:'center',padding:'14px 0'}}>Sin operaciones aún</div>
          :recent.map(op=>(
            <div key={op.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid '+T.border}}>
              <div style={{minWidth:0,flex:1,marginRight:8}}>
                <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',marginBottom:2}}>
                  <Tag bg="#f0f0ea">{modeLab[op.mode]||op.mode}</Tag>
                  {op.clientName&&<Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag>}
                </div>
                <div style={{fontSize:12,color:T.textSub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail||'Sin detalle'}</div>
                <div style={{fontSize:10,color:T.textMuted}}>{fmtDT(op.createdAt)}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                {op.legs?.filter(l=>l.kind==='account'&&l.delta<0).map(l=><div key={l.id} style={{fontSize:11,color:T.red}}>-{fmt(Math.abs(l.delta),l.cur)}</div>)}
                {op.legs?.filter(l=>l.kind==='account'&&l.delta>0).map(l=><div key={l.id} style={{fontSize:11,color:T.green}}>+{fmt(l.delta,l.cur)}</div>)}
                {op.profit!=null&&<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{(op.profit>=0?'+':'')+fmt(op.profit,'USD')}</Tag>}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}

// ── Operaciones ───────────────────────────────────────────────────────────────
function Operaciones({accounts,clients,credits,ops,onAddOp,onEditOp,onDeleteOp,onCreateClient}){
  const mobile=useIsMobile()
  const [open,setOpen]=useState(false),[editOp,setEdit]=useState(null)
  const [confirmId,setConfirmId]=useState(null)
  const [q,setQ]=useState(''),[page,setPage]=useState(1)
  const PER=15
  const accMap=useMemo(()=>{const m={};accounts.forEach(a=>{m[a.id]=a});return m},[accounts])
  const visible=ops.filter(o=>!o.isReversal)
  const filtered=useMemo(()=>[...visible].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).filter(o=>!q||[o.detail,o.clientName].some(s=>(s||'').toLowerCase().includes(q.toLowerCase()))),[visible,q])
  const pages=Math.ceil(filtered.length/PER)||1,paged=filtered.slice((page-1)*PER,page*PER)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',debt_in:'Deuda tomada',debt_pay:'Pago deuda',transfer:'Transfer.'}
  const modeBg={exchange:'#e0f2fe',credit_out:'#fef9c3',credit_in:'#dcfce7',debt_in:'#fdf2f8',debt_pay:'#fff1f2',transfer:'#f5f3ff'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?18:22}}>Operaciones</h2>
        <Btn primary onClick={()=>{setEdit(null);setOpen(true)}}>+ Nueva</Btn>
      </div>
      <Modal open={open} onClose={()=>{setOpen(false);setEdit(null)}} title={editOp?'Editar operación':'Nueva operación'}>
        <OpForm accounts={accounts} clients={clients} credits={credits} editOp={editOp}
          onSubmit={(op,orig)=>orig?onEditOp(op,orig):onAddOp(op)}
          onClose={()=>{setOpen(false);setEdit(null)}}
          onCreateClient={onCreateClient}
        />
      </Modal>
      <Confirm open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={()=>onDeleteOp(confirmId)} message="Se eliminará la operación y su impacto en los saldos se revertirá automáticamente."/>
      <input placeholder="Buscar..." value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} style={{padding:'8px 12px',border:'1.5px solid #e0e0da',borderRadius:10,fontSize:13,background:'#fff'}}/>

      {mobile
        ?<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {paged.length===0
            ?<div style={{textAlign:'center',color:T.textMuted,padding:'2rem'}}>Sin operaciones</div>
            :paged.map(op=>{
              const out=op.legs?.filter(l=>l.delta<0)||[],inA=op.legs?.filter(l=>l.kind==='account'&&l.delta>0)||[],inC=op.legs?.filter(l=>l.kind==='credit'&&l.delta>0)||[]
              return (
                <Card key={op.id} style={{padding:'12px 14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div>
                      <Tag bg={modeBg[op.mode]||'#f0f0ea'}>{modeLab[op.mode]||'—'}</Tag>
                      {op.clientName&&<span style={{marginLeft:4}}><Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag></span>}
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      <Btn small onClick={()=>{setEdit(op);setOpen(true)}}>✏</Btn>
                      <Btn small danger onClick={()=>setConfirmId(op.id)}>🗑</Btn>
                    </div>
                  </div>
                  {op.detail&&<div style={{fontSize:12,color:T.textSub,marginBottom:6}}>{op.detail}</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      {out.map(l=><div key={l.id} style={{fontSize:12,color:T.red,fontWeight:700}}>-{fmt(Math.abs(l.delta),l.cur)}</div>)}
                      {inA.map(l=><div key={l.id} style={{fontSize:12,color:T.green,fontWeight:700}}>+{fmt(l.delta,l.cur)}</div>)}
                      {inC.map(l=><div key={l.id} style={{fontSize:12,color:'#b45309',fontWeight:700}}>💳 {fmt(l.delta,l.cur)}</div>)}
                    </div>
                    <div style={{textAlign:'right'}}>
                      {op.profit!=null&&<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{(op.profit>=0?'+':'')+fmt(op.profit,'USD')}</Tag>}
                      <div style={{fontSize:10,color:T.textMuted,marginTop:2}}>{fmtDT(op.createdAt)}</div>
                    </div>
                  </div>
                </Card>
              )
            })
          }
        </div>
        :<Card style={{padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',width:'100%',minWidth:520}}>
              <thead><tr>{['Fecha','Tipo / Cliente','Sale','Entra / Crédito','Profit',''].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
              <tbody>
                {paged.length===0
                  ?<tr><td colSpan={6} style={{padding:'3rem',textAlign:'center',color:T.textMuted}}>Sin operaciones</td></tr>
                  :paged.map(op=>{
                    const out=op.legs?.filter(l=>l.delta<0)||[],inA=op.legs?.filter(l=>l.kind==='account'&&l.delta>0)||[],inC=op.legs?.filter(l=>l.kind==='credit'&&l.delta>0)||[]
                    return (
                      <tr key={op.id}>
                        <td style={{...TD_S,fontSize:10,color:T.textMuted,whiteSpace:'nowrap'}}>{fmtDT(op.createdAt)}</td>
                        <td style={TD_S}>
                          <Tag bg={modeBg[op.mode]||'#f0f0ea'}>{modeLab[op.mode]||'—'}</Tag>
                          {op.clientName&&<div style={{marginTop:3}}><Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag></div>}
                          {op.detail&&<div style={{fontSize:10,color:T.textMuted,marginTop:2,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail}</div>}
                        </td>
                        <td style={{...TD_S,whiteSpace:'nowrap'}}>
                          {out.map(l=><div key={l.id}><div style={{color:T.red,fontWeight:700}}>-{fmt(Math.abs(l.delta),l.cur)}</div>{l.kind==='account'&&<div style={{fontSize:10,color:T.textMuted}}>{accMap[l.accId]?.name||'—'}</div>}</div>)}
                        </td>
                        <td style={{...TD_S,whiteSpace:'nowrap'}}>
                          {inA.map(l=><div key={l.id}><div style={{color:T.green,fontWeight:700}}>+{fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:T.textMuted}}>{accMap[l.accId]?.name||'—'}</div></div>)}
                          {inC.map(l=><div key={l.id}><div style={{color:'#b45309',fontWeight:700}}>💳 {fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:T.textMuted}}>Crédito: {l.clientName}</div></div>)}
                        </td>
                        <td style={TD_S}>
                          {op.profit!=null?<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{(op.profit>=0?'+':'')+fmt(op.profit,'USD')}</Tag>:'—'}
                          {op.attachments?.length>0&&<div style={{marginTop:3}}><Tag bg={T.blueBg} color={T.blue} size="sm">📎 {op.attachments.length}</Tag></div>}
                        </td>
                        <td style={TD_S}>
                          <div style={{display:'flex',gap:4}}>
                            <Btn small onClick={()=>{setEdit(op);setOpen(true)}}>✏</Btn>
                            <Btn small danger onClick={()=>setConfirmId(op.id)}>🗑</Btn>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </Card>
      }
      {pages>1&&(
        <div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center'}}>
          <Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</Btn>
          <span style={{fontSize:12,color:T.textSub}}>Pág {page}/{pages}</span>
          <Btn onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}>›</Btn>
        </div>
      )}
    </div>
  )
}

// ── Clientes ──────────────────────────────────────────────────────────────────
function ClienteDetalle({client,ops,accounts,credits}){
  const mobile=useIsMobile()
  const d=new Date()
  const [df,setDf]=useState(new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10))
  const [dt,setDt]=useState(d.toISOString().slice(0,10))
  const accMap=useMemo(()=>{const m={};accounts.forEach(a=>{m[a.id]=a});return m},[accounts])
  const cOps=useMemo(()=>clientOps(client.id,ops),[client.id,ops])
  const creds=useMemo(()=>cliCreds(client.id,credits),[client.id,credits])
  const openCr=Object.entries(creds).filter(([,v])=>v>0)
  const openDt=Object.entries(creds).filter(([,v])=>v<0)
  const inRange=cOps.filter(o=>o.createdAt.slice(0,10)>=df&&o.createdAt.slice(0,10)<=dt)
  const totalP=cOps.reduce((s,o)=>s+(o.profit||0),0)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',debt_in:'Deuda tomada',debt_pay:'Pago deuda',transfer:'Transfer.'}
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10}}>
        <div style={{background:'#f0f9ff',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:10,fontWeight:800,color:'#0369a1',textTransform:'uppercase',marginBottom:3}}>Operaciones</div><div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{cOps.length}</div></div>
        <div style={{background:totalP>=0?'#f0fdf4':'#fef2f2',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:10,fontWeight:800,color:totalP>=0?'#166534':'#991b1b',textTransform:'uppercase',marginBottom:3}}>Profit total</div><div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif",color:totalP>=0?'#16a34a':'#dc2626'}}>{(totalP>=0?'+':'')+fmt(totalP,'USD')}</div></div>
        {openCr.length>0&&<div style={{background:'#fffbeb',borderRadius:12,padding:'10px 12px',border:'1.5px solid #fcd34d'}}><div style={{fontSize:10,fontWeight:800,color:'#b45309',textTransform:'uppercase',marginBottom:3}}>Me deben</div>{openCr.map(([cur,v])=><div key={cur} style={{fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",color:'#b45309',wordBreak:'break-all'}}>{fmt(v,cur)}</div>)}</div>}
        {openDt.length>0&&<div style={{background:'#fff1f2',borderRadius:12,padding:'10px 12px',border:'1.5px solid #fda4af'}}><div style={{fontSize:10,fontWeight:800,color:'#be123c',textTransform:'uppercase',marginBottom:3}}>Les debo</div>{openDt.map(([cur,v])=><div key={cur} style={{fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",color:'#be123c',wordBreak:'break-all'}}>{fmt(Math.abs(v),cur)}</div>)}</div>}
      </div>
      <G2 stack={mobile}><Inp label="Desde" type="date" value={df} onChange={e=>setDf(e.target.value)}/><Inp label="Hasta" type="date" value={dt} onChange={e=>setDt(e.target.value)}/></G2>
      <div style={{overflowX:'auto',borderRadius:12,border:'1.5px solid #e8e8e2'}}>
        <table style={{borderCollapse:'collapse',width:'100%',minWidth:380}}>
          <thead><tr>{['Fecha','Tipo','Detalle','Sale','Entra'].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
          <tbody>
            {inRange.length===0
              ?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:T.textMuted}}>Sin operaciones en este período</td></tr>
              :inRange.map(op=>{
                const out=op.legs?.filter(l=>l.delta<0)||[],inL=op.legs?.filter(l=>l.delta>0)||[]
                return (
                  <tr key={op.id}>
                    <td style={{...TD_S,color:T.textMuted,whiteSpace:'nowrap',fontSize:10}}>{fmtD(op.createdAt)}</td>
                    <td style={TD_S}><Tag>{modeLab[op.mode]||'—'}</Tag></td>
                    <td style={{...TD_S,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{op.detail||'—'}</td>
                    <td style={TD_S}>{out.map(l=><div key={l.id} style={{color:l.kind==='account'?'#dc2626':'#b45309',fontWeight:700,whiteSpace:'nowrap'}}>{(l.kind==='credit'?'💳 ':'-')+fmt(Math.abs(l.delta),l.cur)}</div>)}</td>
                    <td style={TD_S}>{inL.map(l=><div key={l.id} style={{color:l.kind==='account'?'#16a34a':'#b45309',fontWeight:700,whiteSpace:'nowrap'}}>{(l.kind==='credit'?'💳 ':'+')+fmt(l.delta,l.cur)}</div>)}</td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Clientes({accounts,clients,ops,credits,onAddClient,onEditClient,onDeleteClient}){
  const mobile=useIsMobile()
  const [open,setOpen]=useState(false),[sel,setSel]=useState(null)
  const [editClient,setEditClient]=useState(null)
  const [confirmId,setConfirmId]=useState(null)
  const [f,sf]=useState({name:'',phone:'',notes:''})
  const [q,setQ]=useState('')
  const [sortBy,setSortBy]=useState('name') // 'name' | 'profit_desc' | 'profit_asc'

  const withProfit = useMemo(()=>clients.map(c=>({
    ...c,
    profit: clientOps(c.id,ops).reduce((s,o)=>s+(o.profit||0),0)
  })),[clients,ops])

  const filtered = useMemo(()=>{
    let list = withProfit.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()))
    if(sortBy==='profit_desc') list=[...list].sort((a,b)=>b.profit-a.profit)
    else if(sortBy==='profit_asc') list=[...list].sort((a,b)=>a.profit-b.profit)
    else list=[...list].sort((a,b)=>a.name.localeCompare(b.name))
    return list
  },[withProfit,q,sortBy])

  const openNew = () => { setEditClient(null); sf({name:'',phone:'',notes:''}); setOpen(true) }
  const openEdit = (c,e) => { e.stopPropagation(); setEditClient(c); sf({name:c.name,phone:c.phone||'',notes:c.notes||''}); setOpen(true) }
  const submit = () => {
    if(!f.name.trim()) return
    if(editClient) onEditClient(editClient.id, f)
    else onAddClient(f)
    sf({name:'',phone:'',notes:''})
    setOpen(false)
    setEditClient(null)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{fontWeight:700,fontSize:mobile?18:22,color:T.text,letterSpacing:'-0.02em'}}>Clientes</h2>
        <Btn primary onClick={openNew}>+ Nuevo</Btn>
      </div>
      <Modal open={open} onClose={()=>{setOpen(false);setEditClient(null)}} title={editClient?'Editar cliente':'Nuevo cliente'}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Nombre / Alias" value={f.name} onChange={e=>sf({...f,name:e.target.value})}/>
          <Inp label="Teléfono" type="tel" value={f.phone} onChange={e=>sf({...f,phone:e.target.value})}/>
          <Inp label="Observaciones" value={f.notes} onChange={e=>sf({...f,notes:e.target.value})}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <Btn onClick={()=>{setOpen(false);setEditClient(null)}}>Cancelar</Btn>
            <Btn primary onClick={submit}>{editClient?'Guardar cambios':'Guardar'}</Btn>
          </div>
        </div>
      </Modal>
      <Modal open={!!sel} onClose={()=>setSel(null)} title={sel?.name||''} wide>
        {sel&&<ClienteDetalle client={sel} ops={ops} accounts={accounts} credits={credits}/>}
      </Modal>
      <Confirm open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={()=>onDeleteClient(confirmId)} message="Se eliminará el cliente y todo su historial de créditos."/>
      {/* Search + sort */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <input placeholder="Buscar cliente..." value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,minWidth:140,padding:'6px 10px',border:'1px solid '+T.border,borderRadius:6,fontSize:13,background:'#fff',color:T.text,outline:'none'}}/>
        <div style={{display:'flex',gap:4,flexShrink:0}}>
          {[{k:'name',l:'A–Z'},{k:'profit_desc',l:'↓ Profit'},{k:'profit_asc',l:'↑ Profit'}].map(s=>(
            <button key={s.k} onClick={()=>setSortBy(s.k)} style={{background:sortBy===s.k?T.text:'#fff',color:sortBy===s.k?'#fff':T.textSub,border:'1px solid '+T.border,borderRadius:6,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:sortBy===s.k?600:400,transition:'all .1s'}}>
              {s.l}
            </button>
          ))}
        </div>
      </div>
      {filtered.length===0&&<div style={{color:T.textMuted,fontSize:13,padding:'1rem 0'}}>No hay clientes. Creá el primero ↑</div>}
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr 1fr':'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
        {filtered.map(c=>{
          const cOps=clientOps(c.id,ops)
          const profit=c.profit
          const creds=cliCreds(c.id,credits)
          const openCr=Object.entries(creds).filter(([,v])=>v>0)
          const openDt=Object.entries(creds).filter(([,v])=>v<0)
          const color=cliColor(c.name)
          return (
            <Card key={c.id} onClick={()=>setSel(c)} style={{borderTop:'4px solid '+color,padding:'14px 16px'}}>
              {/* Header row: avatar + name + actions */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0,flex:1}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0}}>
                    {c.name.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{
                      fontWeight:700,fontSize:14,color:T.text,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                      maxWidth:'100%'
                    }} title={c.name}>{c.name}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:1}}>{cOps.length} op{cOps.length!==1?'s':''}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  <Btn small onClick={e=>openEdit(c,e)}>✏</Btn>
                  <Btn small danger onClick={e=>{e.stopPropagation();setConfirmId(c.id)}}>🗑</Btn>
                </div>
              </div>

              {/* Positions */}
              {openCr.length>0&&(
                <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:6,padding:'6px 10px',marginBottom:4}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#b45309',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>Me deben</div>
                  {openCr.map(([cur,v])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:10,color:'#b45309'}}>{cur}</span>
                      <span style={{fontWeight:700,fontSize:13,color:'#b45309'}}>{fmt(v,cur)}</span>
                    </div>
                  ))}
                </div>
              )}
              {openDt.length>0&&(
                <div style={{background:'#fff1f2',border:'1px solid #fda4af',borderRadius:6,padding:'6px 10px',marginBottom:4}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#be123c',marginBottom:2,textTransform:'uppercase',letterSpacing:'0.04em'}}>Les debo</div>
                  {openDt.map(([cur,v])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:10,color:'#be123c'}}>{cur}</span>
                      <span style={{fontWeight:700,fontSize:13,color:'#be123c'}}>{fmt(Math.abs(v),cur)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Profit bar */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:T.bgApp,borderRadius:6,marginTop:openCr.length||openDt.length?4:0}}>
                <span style={{fontSize:10,fontWeight:600,color:T.textMuted,textTransform:'uppercase',letterSpacing:'0.04em'}}>Profit total</span>
                <span style={{fontWeight:700,fontSize:13,color:profit>=0?T.green:T.red}}>{(profit>=0?'+':'')+fmt(profit,'USD')}</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── Cuentas ───────────────────────────────────────────────────────────────────
function Cuentas({accounts,ops,onAddAccount,onEditAccount,onDeleteAccount,onUpdateOpeningBal}){
  const mobile=useIsMobile()
  const [open,setOpen]=useState(false),[selAcc,setSel]=useState(null)
  const [editAcc,setEditAcc]=useState(null)
  const [confirmId,setConfirmId]=useState(null)
  const [f,sf]=useState({name:'',type:'Efectivo',currency:'USD',titular:'',openingBal:0})

  const titulares = useMemo(()=>[...new Set(accounts.map(a=>a.titular).filter(Boolean))].sort(),[accounts])
  const [filterTitular,setFilterTitular] = useState('todos')
  const [filterCur,setFilterCur]         = useState('todas')
  const [searchAcc,setSearchAcc]         = useState('')

  const allCurrencies = useMemo(()=>[...new Set(accounts.map(a=>a.currency))].sort(),[accounts])

  const visibleAccounts = useMemo(()=>{
    let list = accounts
    if(filterTitular!=='todos') list=list.filter(a=>a.titular===filterTitular)
    if(filterCur!=='todas')     list=list.filter(a=>a.currency===filterCur)
    if(searchAcc.trim())        list=list.filter(a=>a.name.toLowerCase().includes(searchAcc.toLowerCase())||(a.titular||'').toLowerCase().includes(searchAcc.toLowerCase()))
    return [...list].sort((a,b)=>a.name.localeCompare(b.name))
  },[accounts,filterTitular,filterCur,searchAcc])

  const openNew = () => { setEditAcc(null); sf({name:'',type:'Efectivo',currency:'USD',titular:'',openingBal:0}); setOpen(true) }
  const openEdit = (acc,e) => { e.stopPropagation(); setEditAcc(acc); sf({name:acc.name,type:acc.type,currency:acc.currency,titular:acc.titular||'',openingBal:acc.opening_bal||0}); setOpen(true) }
  const submit = () => {
    if(!f.name.trim()) return
    const data = {...f, openingBal: parseFloat(f.openingBal)||0}
    if(editAcc) onEditAccount(editAcc.id, data)
    else onAddAccount(data)
    setOpen(false); setEditAcc(null)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?18:22}}>Cuentas internas</h2>
        <Btn primary onClick={openNew}>+ Nueva</Btn>
      </div>
      <Modal open={open} onClose={()=>{setOpen(false);setEditAcc(null)}} title={editAcc?'Editar cuenta':'Nueva cuenta'}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Nombre" value={f.name} onChange={e=>sf({...f,name:e.target.value})}/>
          <G2 stack={mobile}>
            <Sel label="Tipo" value={f.type} onChange={e=>sf({...f,type:e.target.value})}>{ACC_TYPES.map(t=><option key={t}>{t}</option>)}</Sel>
            <Sel label="Moneda" value={f.currency} onChange={e=>sf({...f,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</Sel>
          </G2>
          <Inp label="Titular" value={f.titular} onChange={e=>sf({...f,titular:e.target.value})}/>
          <Inp label="Saldo inicial" type="number" placeholder="0.00" value={f.openingBal} onChange={e=>sf({...f,openingBal:e.target.value})} hint="Saldo con el que arranca esta cuenta"/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <Btn onClick={()=>{setOpen(false);setEditAcc(null)}}>Cancelar</Btn>
            <Btn primary onClick={submit}>{editAcc?'Guardar cambios':'Guardar'}</Btn>
          </div>
        </div>
      </Modal>
      <Modal open={!!selAcc} onClose={()=>setSel(null)} title={(selAcc?.name||'')+' — Historial'} wide>
        {selAcc&&<AccDetail acc={selAcc} ops={ops} onUpdateAcc={(id,bal)=>{onUpdateOpeningBal(id,bal);setSel(a=>a?{...a,opening_bal:bal}:a)}}/>}
      </Modal>
      <Confirm open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={()=>onDeleteAccount(confirmId)} message="Se eliminará la cuenta. Los movimientos históricos se mantendrán pero el saldo ya no se calculará."/>

      {/* Search bar */}
      <input
        placeholder="Buscar cuenta por nombre o titular..."
        value={searchAcc} onChange={e=>setSearchAcc(e.target.value)}
        style={{padding:'7px 10px',border:'1px solid '+T.border,borderRadius:6,fontSize:13,background:'#fff',color:T.text,outline:'none',width:'100%',boxSizing:'border-box'}}
      />

      {/* Currency filter */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:11,color:T.textMuted,fontWeight:600}}>Moneda:</span>
        {['todas',...allCurrencies].map(c=>(
          <button key={c} onClick={()=>setFilterCur(c)} style={{background:filterCur===c?T.text:'#fff',color:filterCur===c?'#fff':T.textSub,border:'1px solid '+T.border,borderRadius:20,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:filterCur===c?600:400}}>
            {c==='todas'?'Todas':c}
          </button>
        ))}
      </div>

      {/* Titular filter */}
      {titulares.length>1&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:11,color:T.textMuted,fontWeight:600}}>Titular:</span>
          {['todos',...titulares].map(t=>(
            <button key={t} onClick={()=>setFilterTitular(t)} style={{background:filterTitular===t?T.text:'#fff',color:filterTitular===t?'#fff':T.textSub,border:'1px solid '+T.border,borderRadius:20,padding:'3px 10px',cursor:'pointer',fontSize:11,fontWeight:filterTitular===t?600:400}}>
              {t==='todos'?'Todos':t}
            </button>
          ))}
        </div>
      )}

      {visibleAccounts.length===0&&(
        <div style={{color:T.textMuted,fontSize:13,padding:'1rem 0',textAlign:'center'}}>No hay cuentas que coincidan con los filtros.</div>
      )}

      {ACC_TYPES.map(type=>{
        const accs=visibleAccounts.filter(a=>a.type===type)
        if(!accs.length) return null
        return (
          <div key={type}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8,marginTop:4}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc'}}/>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr 1fr':'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
              {accs.map(acc=>{
                const bal=accBal(acc)
                return (
                  <Card key={acc.id} style={{borderLeft:'4px solid '+(ACC_COLOR[acc.type]||'#ccc'),padding:'12px 14px'}}>
                    {/* Header row: name + action buttons */}
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6,gap:4}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:12,fontFamily:"'Syne',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{acc.name}</div>
                        <div style={{fontSize:10,color:T.textMuted}}>{acc.titular?acc.titular+' · ':''}{acc.currency}</div>
                      </div>
                      <div style={{display:'flex',gap:3,flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();openEdit(acc,e)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:2,color:T.textMuted}}>✏</button>
                        <button onClick={e=>{e.stopPropagation();setConfirmId(acc.id)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:2,color:'#fca5a5'}}>🗑</button>
                      </div>
                    </div>
                    {/* Balance — scaled font to fit */}
                    <div onClick={()=>setSel(acc)} style={{cursor:'pointer'}}>
                      <div style={{
                        fontSize: bal===0?20:Math.max(12, Math.min(20, Math.floor(160/Math.max(fmt(bal,acc.currency).length,1)*1.5))),
                        fontWeight:800,fontFamily:"'Syne',sans-serif",
                        color:bal<0?'#dc2626':'#0f0f0f',
                        wordBreak:'break-all',lineHeight:1.2,marginBottom:4
                      }}>{fmt(bal,acc.currency)}</div>
                      <div style={{fontSize:9,color:T.textMuted}}>Ver historial →</div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Reportes ──────────────────────────────────────────────────────────────────
function Reportes({accounts,clients,ops,credits}){
  const mobile=useIsMobile()
  const d=new Date(),visOps=ops.filter(o=>!o.isReversal)
  const [df,setDf]=useState(new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10))
  const [dt,setDt]=useState(d.toISOString().slice(0,10))
  const [preset,setPreset]=useState('month')
  const applyP=p=>{
    setPreset(p);const n=new Date()
    if(p==='today'){setDf(n.toISOString().slice(0,10));setDt(n.toISOString().slice(0,10))}
    else if(p==='week'){const s=new Date(n);s.setDate(n.getDate()-6);setDf(s.toISOString().slice(0,10));setDt(n.toISOString().slice(0,10))}
    else if(p==='month'){setDf(new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10));setDt(n.toISOString().slice(0,10))}
    else if(p==='year'){setDf(new Date(n.getFullYear(),0,1).toISOString().slice(0,10));setDt(n.toISOString().slice(0,10))}
  }
  const inRange=useMemo(()=>visOps.filter(o=>o.createdAt.slice(0,10)>=df&&o.createdAt.slice(0,10)<=dt),[visOps,df,dt])
  const profit=inRange.reduce((s,o)=>s+(o.profit||0),0)
  const pByCli=useMemo(()=>{
    const m={}
    inRange.filter(o=>o.clientId&&o.profit).forEach(o=>{if(!m[o.clientId])m[o.clientId]={name:o.clientName,profit:0,ops:0};m[o.clientId].profit+=o.profit;m[o.clientId].ops++})
    return Object.values(m).sort((a,b)=>b.profit-a.profit)
  },[inRange])
  const vol=useMemo(()=>{const b={};inRange.forEach(o=>{(o.legs||[]).filter(l=>l.kind==='account'&&l.delta<0).forEach(l=>{b[l.cur]=(b[l.cur]||0)+Math.abs(l.delta)})});return b},[inRange])
  const accS=useMemo(()=>accSumByType(accounts),[accounts])
  const allCr=useMemo(()=>allCredByCur(credits),[credits])
  const cols=mobile?'1fr':'1fr 1fr'
  const PRESETS=[{k:'today',l:'Hoy'},{k:'week',l:'7 días'},{k:'month',l:'Este mes'},{k:'year',l:'Este año'},{k:'custom',l:'Libre'}]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?18:22}}>Reportes</h2>
      <Card>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:12,marginBottom:10}}>Rango de fecha</div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
          {PRESETS.map(p=><Btn key={p.k} small onClick={()=>applyP(p.k)} style={{background:preset===p.k?'#0f0f0f':'#f0f0ea',color:preset===p.k?'#fff':'#555',border:'none'}}>{p.l}</Btn>)}
        </div>
        <G2 stack={mobile}>
          <Inp label="Desde" type="date" value={df} onChange={e=>{setDf(e.target.value);setPreset('custom')}}/>
          <Inp label="Hasta" type="date" value={dt} onChange={e=>{setDt(e.target.value);setPreset('custom')}}/>
        </G2>
        <div style={{marginTop:8,fontSize:12,color:T.textSub}}>{inRange.length} operaciones en el período</div>
      </Card>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Card style={{background:profit>=0?'#dcfce7':'#fee2e2',border:'none',padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Profit período</div>
          <div style={{fontSize:mobile?18:22,fontWeight:800,fontFamily:"'Syne',sans-serif",color:profit>=0?'#16a34a':'#dc2626'}}>{(profit>=0?'+':'')+fmt(profit,'USD')}</div>
        </Card>
        <Card style={{background:'#f0f9ff',border:'none',padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4,fontFamily:"'Syne',sans-serif"}}>Operaciones</div>
          <div style={{fontSize:mobile?18:22,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{inRange.length}</div>
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:cols,gap:14}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Volumen operado</div>
          {Object.keys(vol).length===0?<div style={{fontSize:12,color:T.textMuted}}>Sin operaciones</div>:Object.entries(vol).map(([cur,v])=>(
            <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid '+T.border}}>
              <Tag>{cur}</Tag><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14}}>{fmt(v,cur)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Profit por cliente</div>
          {pByCli.length===0?<div style={{fontSize:12,color:T.textMuted}}>Sin datos</div>:pByCli.map(({name,profit:p,ops:n})=>(
            <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid '+T.border}}>
              <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                <div style={{width:20,height:20,borderRadius:'50%',background:cliColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,flexShrink:0}}>{name.slice(0,2)}</div>
                <div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div><div style={{fontSize:10,color:T.textMuted}}>{n} ops</div></div>
              </div>
              <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:13,color:p>=0?'#16a34a':'#dc2626',flexShrink:0,marginLeft:8}}>{(p>=0?'+':'')+fmt(p,'USD')}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:cols,gap:14}}>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Saldos actuales</div>
          {ACC_TYPES.map(type=>{
            const ent=Object.entries(accS[type]||{})
            return (
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc',flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span>
                </div>
                {ent.length===0
                  ?<div style={{fontSize:11,color:T.textMuted,paddingLeft:12}}>$0</div>
                  :ent.map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'1px 0 1px 9px',borderLeft:'2px solid '+(ACC_COLOR[type]||'#eee')}}>
                      <span style={{fontSize:12,color:T.textSub}}>{cur}</span>
                      <span style={{fontSize:12,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </Card>
        <Card>
          <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:12}}>Posiciones abiertas</div>
          {(()=>{
            const creds=allCredByCur(credits)
            const debts=allDebtsByCur(credits)
            const hasAny=Object.keys(creds).length>0||Object.keys(debts).length>0
            if(!hasAny) return <div style={{textAlign:'center',padding:'12px 0'}}><div style={{fontSize:22}}>✓</div><div style={{fontSize:12,color:T.textSub,marginTop:3}}>Sin posiciones</div></div>
            return <>
              {Object.keys(creds).length>0&&<>
                <div style={{fontSize:10,fontWeight:700,color:'#b45309',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Me deben →</div>
                {Object.entries(creds).map(([cur,v])=>(
                  <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid '+T.border}}>
                    <Tag bg="#fef9c3" color="#b45309">{cur}</Tag>
                    <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14,color:'#b45309'}}>{fmt(v,cur)}</span>
                  </div>
                ))}
              </>}
              {Object.keys(debts).length>0&&<>
                <div style={{fontSize:10,fontWeight:700,color:'#be123c',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,marginTop:Object.keys(creds).length>0?10:0}}>← Les debo</div>
                {Object.entries(debts).map(([cur,v])=>(
                  <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid '+T.border}}>
                    <Tag bg="#fff1f2" color="#be123c">{cur}</Tag>
                    <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14,color:'#be123c'}}>{fmt(Math.abs(v),cur)}</span>
                  </div>
                ))}
              </>}
            </>
          })()}
        </Card>
      </div>

      {/* Saldo por titular */}
      {(()=>{
        const titulares = [...new Set(accounts.map(a=>a.titular).filter(Boolean))].sort()
        if(titulares.length===0) return null
        const byTitular = titulares.map(tit=>{
          const accs = accounts.filter(a=>a.titular===tit)
          const byCur = {}
          accs.forEach(a=>{ byCur[a.currency]=(byCur[a.currency]||0)+accBal(a) })
          const totalUSD = Object.entries(byCur).reduce((s,[cur,v])=>s+toUSD(v,cur),0)
          return {tit, byCur, totalUSD}
        })
        return (
          <Card>
            <div style={{fontWeight:600,fontSize:13,color:T.text,letterSpacing:'-0.01em',marginBottom:14}}>Saldo por titular</div>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
              {byTitular.map(({tit,byCur,totalUSD})=>(
                <div key={tit} style={{background:T.bgApp,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:8}}>{tit}</div>
                  {Object.entries(byCur).map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}>
                      <span style={{fontSize:11,color:T.textSub}}>{cur}</span>
                      <span style={{fontSize:12,fontWeight:600,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #e8e8e2',marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:10,color:T.textSub,textTransform:'uppercase',fontWeight:700}}>Total USD</span>
                    <span style={{fontSize:13,fontWeight:800,fontFamily:"'Syne',sans-serif",color:totalUSD<0?'#dc2626':'#0f0f0f'}}>{fmt(totalUSD,'USD')}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function TreasuryApp(){
  const mobile=useIsMobile()
  const {profile,signOut,isOperator}=useAuth()
  const {data:accounts,refetch:refetchAccounts}=useAccounts()
  const {data:clients, refetch:refetchClients} =useClients()
  const {data:ops,     refetch:refetchOps}     =useOperations()
  const {data:credits, refetch:refetchCredits} =useCreditBalances()
  const [tab,setTab]=useState('Dashboard')

  const run = async (fn, ...refetches) => { try{ await fn(); refetches.forEach(r=>r()) }catch(e){ alert('Error: '+e.message) } }

  // Inline client creation from within OpForm dropdown
  const handleCreateClientInline = async (name, cb) => {
    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error } = await supabase.from('clients').insert({name, phone:'', notes:''}).select('id').single()
      if(error) throw error
      await refetchClients()
      cb && cb(data.id)
    } catch(e){ alert('Error al crear cliente: '+e.message) }
  }

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif",flexDirection:mobile?'column':'row'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:${T.bgApp};font-family:'DM Sans',sans-serif}`}</style>
      <Sidebar tab={tab} setTab={setTab} profile={profile} signOut={signOut} mobile={mobile}/>
      <main style={{flex:1,padding:mobile?'12px 12px 80px':'24px 28px',overflowY:'auto',overflowX:'hidden',maxWidth:'100%'}}>
        {tab==='Dashboard'  &&<Dashboard   accounts={accounts} clients={clients} ops={ops} credits={credits} setTab={setTab}/>}
        {tab==='Operaciones'&&<Operaciones accounts={accounts} clients={clients} credits={credits} ops={ops}
          onAddOp={op=>run(()=>addOperation(op),refetchOps,refetchAccounts,refetchCredits)}
          onEditOp={(op,orig)=>run(()=>editOperation(op,orig),refetchOps,refetchAccounts,refetchCredits)}
          onDeleteOp={id=>run(()=>deleteOperation(id),refetchOps,refetchAccounts,refetchCredits)}
          onCreateClient={handleCreateClientInline}
        />}
        {tab==='Clientes'   &&<Clientes    accounts={accounts} clients={clients} ops={ops} credits={credits}
          onAddClient={c=>run(()=>addClient(c),refetchClients)}
          onEditClient={(id,f)=>run(()=>updateClient(id,{name:f.name,phone:f.phone,notes:f.notes}),refetchClients)}
          onDeleteClient={id=>run(()=>deleteClient(id),refetchClients,refetchCredits)}
        />}
        {tab==='Cuentas'    &&<Cuentas     accounts={accounts} ops={ops}
          onAddAccount={a=>run(()=>addAccount(a),refetchAccounts)}
          onEditAccount={(id,f)=>run(()=>updateAccount(id,{name:f.name,type:f.type,currency:f.currency,titular:f.titular,opening_bal:f.openingBal}),refetchAccounts)}
          onDeleteAccount={id=>run(()=>deleteAccount(id),refetchAccounts)}
          onUpdateOpeningBal={(id,bal)=>run(()=>updateAccountOpeningBal(id,bal),refetchAccounts)}
        />}
        {tab==='Reportes'   &&<Reportes    accounts={accounts} clients={clients} ops={ops} credits={credits}/>}
      </main>
    </div>
  )
}
