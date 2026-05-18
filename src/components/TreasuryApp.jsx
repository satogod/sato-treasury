import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  useAccounts, useClients, useOperations, useCreditBalances,
  addOperation, editOperation, deleteOperation,
  addClient, updateClient, deleteClient,
  addAccount, updateAccount, deleteAccount, updateAccountOpeningBal,
} from '../hooks/useData'

// ── Constants ─────────────────────────────────────────────────────────────────
const CURRENCIES = ['USD','PYG','USDT','BRL','EUR']
const ACC_TYPES  = ['Efectivo','Banco','Wallet Crypto','Broker/Plataforma']
const USD_RATE   = {USD:1,USDT:1,PYG:1/6200,BRL:1/5.1,EUR:1.08}
const toUSD      = (v,c) => v*(USD_RATE[c]||1)
const ACC_COLOR  = {Efectivo:'#fde047',Banco:'#93c5fd','Wallet Crypto':'#6ee7b7','Broker/Plataforma':'#c4b5fd'}
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
const fmtD  = iso => new Date(iso).toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'2-digit'})
const fmtDT = iso => new Date(iso).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
const uid   = () => Math.random().toString(36).slice(2,9)

// ── Balance helpers ───────────────────────────────────────────────────────────
const accBal       = acc => Number(acc.balance||0)
const cliCreds     = (cid,credits) => { const b={}; credits.filter(r=>r.client_id===cid).forEach(r=>{b[r.currency]=(b[r.currency]||0)+Number(r.balance)}); return b }
const allCredByCur = credits => { const b={}; credits.filter(r=>Number(r.balance)>0).forEach(r=>{b[r.currency]=(b[r.currency]||0)+Number(r.balance)}); return b }
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

// ── UI atoms ──────────────────────────────────────────────────────────────────
const Card    = ({children,style,onClick}) => <div onClick={onClick} style={{background:'#fff',border:'1.5px solid #e8e8e2',borderRadius:14,padding:'14px 16px',cursor:onClick?'pointer':undefined,...style}}>{children}</div>
const Btn     = ({children,onClick,primary,small,disabled,danger,style}) => <button onClick={onClick} disabled={disabled} style={{background:danger?'#fee2e2':primary?'#0f0f0f':'#fff',color:danger?'#dc2626':primary?'#fff':'#0f0f0f',border:danger?'1px solid #fecaca':primary?'none':'1.5px solid #e0e0da',borderRadius:10,padding:small?'5px 11px':'8px 16px',fontWeight:600,fontSize:small?11:13,fontFamily:"'Syne',sans-serif",cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,whiteSpace:'nowrap',...style}}>{children}</button>
const Tag     = ({children,bg,color}) => <span style={{display:'inline-flex',padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:bg||'#f0f0ea',color:color||'#0f0f0f',fontFamily:"'Syne',sans-serif",whiteSpace:'nowrap'}}>{children}</span>
const Fld     = ({label,children,hint}) => <div style={{display:'flex',flexDirection:'column',gap:4}}>{label&&<label style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}{children}{hint&&<div style={{fontSize:10,color:'#aaa',marginTop:2}}>{hint}</div>}</div>
const Inp     = ({label,hint,...p}) => <Fld label={label} hint={hint}><input style={{background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,padding:'8px 12px',width:'100%',fontSize:13,boxSizing:'border-box'}} {...p}/></Fld>
const Sel     = ({label,children,...p}) => <Fld label={label}><select style={{background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,padding:'8px 12px',width:'100%',fontSize:13,boxSizing:'border-box'}} {...p}>{children}</select></Fld>
const G2      = ({children,gap,stack}) => <div style={{display:'grid',gridTemplateColumns:stack?'1fr':'1fr 1fr',gap:gap||12}}>{children}</div>
const Divider = () => <div style={{borderTop:'1.5px dashed #e8e8e2',margin:'4px 0'}}/>
const TH_S    = {padding:'8px 10px',textAlign:'left',fontWeight:800,fontSize:10,color:'#888',background:'#f8f8f4',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap',fontFamily:"'Syne',sans-serif"}
const TD_S    = {padding:'8px 10px',borderBottom:'1px solid #f4f4f0',fontSize:12,verticalAlign:'middle'}

// ── Modal — slides up from center, not bottom ─────────────────────────────────
function Modal({open,onClose,title,children,wide}){
  if(!open) return null
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999,padding:'16px'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fafaf8',borderRadius:20,padding:'20px',width:'100%',maxWidth:wide?680:540,maxHeight:'88vh',overflowY:'auto',border:'1.5px solid #e8e8e2',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
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
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:24,width:'min(360px,95vw)',border:'1.5px solid #e8e8e2',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
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
          <span style={{fontSize:10,color:'#aaa',marginLeft:6}}>{open?'▲':'▼'}</span>
        </div>
        {open&&(
          <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden'}}>
            <div style={{padding:'6px 8px',borderBottom:'1px solid #f0f0ea'}}>
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
                ?<div style={{padding:'10px 12px',fontSize:12,color:'#aaa'}}>Sin resultados</div>
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
                      <div style={{fontSize:10,color:'#aaa'}}>{a.type}{a.titular?' · '+a.titular:''}</div>
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

// ── Op Form ───────────────────────────────────────────────────────────────────
function OpForm({accounts,clients,credits,onSubmit,onClose,editOp}){
  const mobile = useIsMobile()
  const [mode,setMode] = useState(editOp?.mode||'exchange')
  const initF = () => {
    if(editOp){
      const o=editOp.legs?.find(l=>l.delta<0),ia=editOp.legs?.find(l=>l.kind==='account'&&l.delta>0),ic=editOp.legs?.find(l=>l.kind==='credit'&&l.delta>0)
      return{date:editOp.createdAt.slice(0,16),fromAccId:o?.accId||accounts[0]?.id,fromAmt:String(Math.abs(o?.delta||0)||''),toAccId:ia?.accId||accounts[0]?.id,toAmt:String(ia?.delta||''),clientId:editOp.clientId||'',creditCur:ic?.cur||'USD',creditAmt:String(Math.abs(ic?.delta||0)||''),rate:editOp.rate?String(editOp.rate):'',detail:editOp.detail||''}
    }
    return{date:new Date().toISOString().slice(0,16),fromAccId:accounts.find(a=>a.currency==='USDT')?.id||accounts[0]?.id,fromAmt:'',toAccId:accounts.find(a=>a.currency==='USD'&&a.type==='Efectivo')?.id||accounts[0]?.id,toAmt:'',clientId:clients[0]?.id||'',creditCur:'USD',creditAmt:'',rate:'',detail:''}
  }
  const [f,sf] = useState(initF)
  const set = (k,v) => sf(x=>({...x,[k]:v}))

  const fromAcc = accounts.find(a=>a.id===f.fromAccId)
  const toAcc   = accounts.find(a=>a.id===f.toAccId)
  const client  = clients.find(c=>c.id===f.clientId)
  const existCreds = useMemo(()=>f.clientId?cliCreds(f.clientId,credits):{},[f.clientId,credits])

  // Auto profit
  const autoProfit = useMemo(()=>{
    if(mode==='transfer') return null
    const fa=parseFloat(f.fromAmt),ta=parseFloat(mode==='credit_out'?f.creditAmt:f.toAmt)
    const tc=mode==='credit_out'?f.creditCur:(toAcc?.currency||'USD')
    if(!fa||!ta) return null
    return +(toUSD(ta,tc)-toUSD(fa,fromAcc?.currency||'USD')).toFixed(2)
  },[mode,f,fromAcc,toAcc])

  // Auto rate — recalculate whenever amounts change
  const autoRate = useMemo(()=>{
    if(mode==='transfer') return null
    const fa=parseFloat(f.fromAmt),ta=parseFloat(mode==='credit_out'?f.creditAmt:f.toAmt)
    const fc=fromAcc?.currency||'USD'
    const tc=mode==='credit_out'?f.creditCur:(toAcc?.currency||'USD')
    if(fc===tc) return null // same currency, no rate
    return calcRate(fa, fc, ta, tc)
  },[mode,f,fromAcc,toAcc])

  const submit = () => {
    const fa=parseFloat(f.fromAmt)||0,ta=parseFloat(f.toAmt)||0,ca=parseFloat(f.creditAmt)||0,legs=[]
    const rateToSave = autoRate || parseFloat(f.rate) || null
    if(mode==='exchange'){
      if(!fa||!ta){alert('Ingresá ambos montos');return}
      legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa})
      legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta})
    } else if(mode==='credit_out'){
      if(!fa||!ca){alert('Ingresá ambos montos');return}
      legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa})
      legs.push({id:uid(),kind:'credit',clientId:f.clientId,clientName:client?.name,cur:f.creditCur,delta:ca})
    } else if(mode==='credit_in'){
      if(!ca||!ta){alert('Ingresá ambos montos');return}
      legs.push({id:uid(),kind:'credit',clientId:f.clientId,clientName:client?.name,cur:f.creditCur,delta:-ca})
      legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta})
    } else if(mode==='transfer'){
      if(!fa){alert('Ingresá el monto');return}
      legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa})
      legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta||fa})
    }
    onSubmit({id:editOp?editOp.id:uid(),createdAt:new Date(f.date).toISOString(),detail:f.detail,mode,clientId:f.clientId||null,clientName:client?.name||null,rate:rateToSave,profit:autoProfit,legs},editOp)
    onClose()
  }

  const accOpts = accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)
  const cliOpts = clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)
  const MODES = [{k:'exchange',icon:'⇄',label:'Cambio cerrado',desc:'Pago en el momento'},{k:'credit_out',icon:'📤',label:'Crédito dado',desc:'Te queda debiendo'},{k:'credit_in',icon:'📥',label:'Cobro de deuda',desc:'Salda su deuda'},{k:'transfer',icon:'↔',label:'Transferencia',desc:'Entre tus cuentas'}]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {MODES.map(m=>(
          <button key={m.k} onClick={()=>setMode(m.k)} style={{background:mode===m.k?'#0f0f0f':'#f8f8f4',color:mode===m.k?'#fff':'#555',border:'1.5px solid '+(mode===m.k?'#0f0f0f':'#e8e8e2'),borderRadius:10,padding:'8px 10px',cursor:'pointer',textAlign:'left'}}>
            <div style={{fontSize:14,marginBottom:1}}>{m.icon}</div>
            <div style={{fontWeight:700,fontSize:11,fontFamily:"'Syne',sans-serif"}}>{m.label}</div>
            <div style={{fontSize:10,opacity:.6}}>{m.desc}</div>
          </button>
        ))}
      </div>
      <Divider/>
      <Inp label="Fecha y hora" type="datetime-local" value={f.date} onChange={e=>set('date',e.target.value)}/>

      {mode==='exchange'&&<>
        <div style={{background:'#fff5f5',border:'1.5px solid #fecaca',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#dc2626',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📤 Sale de tu cuenta</div>
          <G2 stack={mobile}>
            <AccSearch label="Cuenta" accounts={accounts} value={f.fromAccId} onChange={v=>set('fromAccId',v)}/>
            <Inp label={'Monto ('+(fromAcc?.currency||'—')+')'} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/>
          </G2>
        </div>
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#16a34a',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📥 Entra a tu cuenta</div>
          <G2 stack={mobile}>
            <AccSearch label="Cuenta" accounts={accounts} value={f.toAccId} onChange={v=>set('toAccId',v)}/>
            <Inp label={'Monto ('+(toAcc?.currency||'—')+')'} type="number" placeholder="0.00" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/>
          </G2>
        </div>
        <Sel label="Cliente contraparte (opcional)" value={f.clientId} onChange={e=>set('clientId',e.target.value)}><option value="">— Sin cliente —</option>{cliOpts}</Sel>
      </>}

      {mode==='credit_out'&&<>
        <div style={{background:'#fff5f5',border:'1.5px solid #fecaca',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#dc2626',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📤 Lo que enviás</div>
          <G2 stack={mobile}>
            <AccSearch label="Tu cuenta" accounts={accounts} value={f.fromAccId} onChange={v=>set('fromAccId',v)}/>
            <Inp label={'Monto ('+(fromAcc?.currency||'—')+')'} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/>
          </G2>
        </div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#b45309',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>💳 Lo que te queda debiendo</div>
          <Sel label="Cliente" value={f.clientId} onChange={e=>set('clientId',e.target.value)}>{cliOpts}</Sel>
          <div style={{marginTop:8}}><G2 stack={mobile} gap={8}><Inp label="Monto que te debe" type="number" placeholder="0.00" value={f.creditAmt} onChange={e=>set('creditAmt',e.target.value)}/><Sel label="Moneda" value={f.creditCur} onChange={e=>set('creditCur',e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</Sel></G2></div>
          {Object.entries(existCreds).filter(([,v])=>v>0).length>0&&<div style={{marginTop:6,fontSize:11,color:'#b45309'}}>Deuda actual: {Object.entries(existCreds).filter(([,v])=>v>0).map(([c,v])=>fmt(v,c)).join(' / ')}</div>}
        </div>
      </>}

      {mode==='credit_in'&&<>
        <Sel label="Cliente que paga" value={f.clientId} onChange={e=>set('clientId',e.target.value)}>{cliOpts}</Sel>
        {Object.entries(existCreds).filter(([,v])=>v>0).length>0&&(
          <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:10,padding:'10px 12px',fontSize:12}}>
            <div style={{fontWeight:700,marginBottom:4,color:'#b45309'}}>Deuda pendiente:</div>
            {Object.entries(existCreds).filter(([,v])=>v>0).map(([c,v])=><div key={c} style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>{c}</span><span style={{fontWeight:700}}>{fmt(v,c)}</span></div>)}
          </div>
        )}
        <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#b45309',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>💳 Deuda que se cancela</div>
          <G2 stack={mobile} gap={8}><Inp label="Monto" type="number" placeholder="0.00" value={f.creditAmt} onChange={e=>set('creditAmt',e.target.value)}/><Sel label="Moneda" value={f.creditCur} onChange={e=>set('creditCur',e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</Sel></G2>
        </div>
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#16a34a',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📥 Entra a tu cuenta</div>
          <G2 stack={mobile}>
            <AccSearch label="Cuenta" accounts={accounts} value={f.toAccId} onChange={v=>set('toAccId',v)}/>
            <Inp label={'Monto ('+(toAcc?.currency||'—')+')'} type="number" placeholder="0.00" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/>
          </G2>
        </div>
      </>}

      {mode==='transfer'&&(
        <div style={{background:'#f5f3ff',border:'1.5px solid #c4b5fd',borderRadius:12,padding:'10px 12px'}}>
          <div style={{fontSize:10,fontWeight:800,color:'#7c3aed',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>↔ Entre tus cuentas</div>
          <G2 stack={mobile}>
            <AccSearch label="Origen" accounts={accounts} value={f.fromAccId} onChange={v=>set('fromAccId',v)}/>
            <AccSearch label="Destino" accounts={accounts} value={f.toAccId} onChange={v=>set('toAccId',v)}/>
          </G2>
          <div style={{marginTop:8}}>
            <G2 stack={mobile}>
              <Inp label={'Sale ('+(fromAcc?.currency||'—')+')'} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/>
              <Inp label={'Entra ('+(toAcc?.currency||'—')+')'} type="number" placeholder="igual si misma moneda" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/>
            </G2>
          </div>
        </div>
      )}

      {/* Auto rate display */}
      {autoRate!==null&&(
        <div style={{background:'#f0f9ff',border:'1.5px solid #bae6fd',borderRadius:10,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'#0369a1',fontWeight:600}}>Cotización calculada</span>
          <span style={{fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",color:'#0369a1'}}>{autoRate.toLocaleString('es-PY')}</span>
        </div>
      )}

      {autoProfit!==null&&(
        <div style={{background:autoProfit>=0?'#f0fdf4':'#fef2f2',border:'1.5px solid '+(autoProfit>=0?'#86efac':'#fca5a5'),borderRadius:10,padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,fontWeight:600,color:'#666'}}>Profit/Loss (USD)</span>
          <span style={{fontWeight:800,fontSize:16,fontFamily:"'Syne',sans-serif",color:autoProfit>=0?'#16a34a':'#dc2626'}}>{(autoProfit>=0?'+':'')+fmt(autoProfit,'USD')}</span>
        </div>
      )}

      <Inp label="Detalle / Comentario" placeholder="Descripción de la operación" value={f.detail} onChange={e=>set('detail',e.target.value)}/>
      <div style={{fontSize:10,color:'#aaa',textAlign:'center'}}>Ref: 1 USDT=$1 · 1 EUR=$1.08 · ₲6200=$1 · R$5.1=$1</div>
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
  const modeLab = {exchange:'Cambio',credit_out:'Crédito',credit_in:'Cobro',transfer:'Transfer.'}
  let running = Number(acc.opening_bal||0)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
        <div style={{background:ACC_COLOR[acc.type]||'#f0f0ea',borderRadius:12,padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{acc.type}</div>
          <div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",wordBreak:'break-all'}}>{fmt(accBal(acc),acc.currency)}</div>
          <div style={{fontSize:11,marginTop:3,opacity:.7}}>{acc.currency}{acc.titular?' · '+acc.titular:''}</div>
        </div>
        <div style={{background:'#f8f8f4',borderRadius:12,padding:'12px 14px'}}>
          <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,color:'#888'}}>Saldo inicial</div>
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
            <tr style={{background:'#fafaf8'}}><td style={{...TD_S,fontSize:10,color:'#aaa'}}>—</td><td style={TD_S}><Tag>Inicial</Tag></td><td style={TD_S}>Saldo inicial</td><td style={{...TD_S,fontWeight:700,color:'#888'}}>{fmt(acc.opening_bal||0,acc.currency)}</td><td style={{...TD_S,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(acc.opening_bal||0,acc.currency)}</td></tr>
            {accOps.length===0
              ?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'#ccc'}}>Sin movimientos aún</td></tr>
              :accOps.map(row=>{ running+=row.delta; const snap=running; return (
                <tr key={row.id}>
                  <td style={{...TD_S,fontSize:10,color:'#aaa',whiteSpace:'nowrap'}}>{fmtDT(row.date)}</td>
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
const T_ICON = {Dashboard:'◉',Operaciones:'⇄',Clientes:'◈',Cuentas:'▣',Reportes:'◆'}
const T_COL  = {Dashboard:'#fde047',Operaciones:'#f9a8d4',Clientes:'#93c5fd',Cuentas:'#86efac',Reportes:'#c4b5fd'}

function Sidebar({tab,setTab,profile,signOut,mobile}){
  if(mobile) return (
    <>
      <div style={{position:'sticky',top:0,background:'#0f0f0f',zIndex:100,padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:'#fff',letterSpacing:'-0.02em'}}>SATO TREASURY</div>
        <button onClick={signOut} style={{background:'none',border:'1px solid #333',borderRadius:8,padding:'4px 10px',color:'#666',cursor:'pointer',fontSize:11}}>Salir</button>
      </div>
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0f0f0f',display:'flex',zIndex:200,borderTop:'1px solid #1a1a1a'}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,background:tab===t?T_COL[t]:'transparent',color:tab===t?'#0f0f0f':'#555',border:'none',padding:'8px 0 6px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
            <span style={{fontSize:15}}>{T_ICON[t]}</span>
            <span style={{fontSize:9,fontWeight:tab===t?700:400,fontFamily:"'DM Sans',sans-serif"}}>{t}</span>
          </button>
        ))}
      </div>
    </>
  )
  return (
    <div style={{width:175,minWidth:175,background:'#0f0f0f',display:'flex',flexDirection:'column',padding:'20px 0',position:'sticky',top:0,height:'100vh',flexShrink:0}}>
      <div style={{padding:'0 16px 20px',borderBottom:'1px solid #222'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'#fff',letterSpacing:'-0.02em'}}>SATO</div>
        <div style={{fontSize:10,color:'#555',marginTop:2,letterSpacing:'0.1em'}}>TREASURY</div>
      </div>
      <nav style={{display:'flex',flexDirection:'column',gap:2,padding:'14px 8px',flex:1}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?T_COL[t]:'transparent',color:tab===t?'#0f0f0f':'#555',border:'none',borderRadius:10,padding:'9px 12px',cursor:'pointer',textAlign:'left',fontWeight:tab===t?700:400,fontSize:12,fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:13}}>{T_ICON[t]}</span>{t}
          </button>
        ))}
      </nav>
      <div style={{padding:'12px 16px',borderTop:'1px solid #222'}}>
        <div style={{fontSize:12,color:'#555',marginBottom:4,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name}</div>
        <div style={{fontSize:10,color:'#444',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{profile?.role}</div>
        <button onClick={signOut} style={{background:'none',border:'1px solid #333',borderRadius:8,padding:'5px 10px',color:'#666',cursor:'pointer',fontSize:11,width:'100%'}}>Cerrar sesión</button>
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
  const credSumm=useMemo(()=>{const r=[];clients.forEach(c=>{const b=cliCreds(c.id,credits);const d=Object.entries(b).filter(([,v])=>v>0);if(d.length>0)r.push({c,debts:d})});return r},[clients,credits])
  const accSumm=useMemo(()=>accSumByType(accounts),[accounts])
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?20:26,letterSpacing:'-0.03em'}}>Buenos días ☀</h1>
        <p style={{color:'#888',fontSize:13,marginTop:4}}>{visOps.length} operaciones · {clients.length} clientes</p>
      </div>

      <div style={{background:'#0f0f0f',borderRadius:16,padding:mobile?'16px':'20px 24px',color:'#fff'}}>
        <div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em',color:'#555',marginBottom:6}}>Patrimonio neto (USD)</div>
        <div style={{fontSize:mobile?26:34,fontWeight:800,fontFamily:"'Syne',sans-serif",letterSpacing:'-0.03em',color:nw>=0?'#86efac':'#fca5a5',wordBreak:'break-all'}}>{(nw>=0?'+':'')+fmt(nw,'USD')}</div>
        <div style={{display:'flex',gap:16,marginTop:10,flexWrap:'wrap'}}>
          <div><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em'}}>Mis cuentas</div><div style={{fontSize:14,fontWeight:700,color:'#93c5fd'}}>{fmt(myUSD,'USD')}</div></div>
          <div><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em'}}>Créditos</div><div style={{fontSize:14,fontWeight:700,color:crUSD>=0?'#86efac':'#fca5a5'}}>{(crUSD>=0?'+':'')+fmt(crUSD,'USD')}</div></div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[{l:'Ganancia hoy',v:fmt(today,'USD'),bg:'#fde047'},{l:'Ganancia mes',v:fmt(month,'USD'),bg:'#f9a8d4'},{l:'Créditos abiertos',v:credSumm.length,bg:credSumm.length>0?'#fca5a5':'#86efac'},{l:'Operaciones',v:visOps.length,bg:'#93c5fd'}].map(({l,v,bg})=>(
          <Card key={l} style={{background:bg,border:'none',padding:'12px 14px'}}>
            <div style={{fontSize:10,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>{l}</div>
            <div style={{fontSize:mobile?18:22,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{v}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:14}}>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Saldos por tipo</div>
          {ACC_TYPES.map(type=>{
            const ent=Object.entries(accSumm[type]||{}).filter(([,v])=>v!==0)
            return (
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc',flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span>
                </div>
                {ent.length===0
                  ?<div style={{fontSize:11,color:'#ccc',paddingLeft:13}}>$0</div>
                  :ent.map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'1px 0 1px 10px',borderLeft:'2px solid '+(ACC_COLOR[type]||'#eee')}}>
                      <span style={{fontSize:12,color:'#888'}}>{cur}</span>
                      <span style={{fontSize:13,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </Card>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Créditos abiertos</div>
          {credSumm.length===0
            ?<div style={{textAlign:'center',padding:'12px 0'}}><div style={{fontSize:22}}>✓</div><div style={{fontSize:12,color:'#888',marginTop:4}}>Sin créditos</div></div>
            :credSumm.map(({c,debts})=>(
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',marginBottom:6,background:'#fffbeb',borderRadius:10,border:'1px solid #fcd34d'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:'50%',background:cliColor(c.name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{c.name.slice(0,2)}</div>
                  <span style={{fontWeight:600,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                </div>
                <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                  {debts.map(([cur,v])=><div key={cur} style={{fontSize:12,fontWeight:700,color:'#b45309'}}>{fmt(v,cur)}</div>)}
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13}}>Últimas operaciones</div>
          <Btn small onClick={()=>setTab('Operaciones')}>Ver todas →</Btn>
        </div>
        {recent.length===0
          ?<div style={{fontSize:12,color:'#ccc',textAlign:'center',padding:'14px 0'}}>Sin operaciones aún</div>
          :recent.map(op=>(
            <div key={op.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid #f0f0ea'}}>
              <div style={{minWidth:0,flex:1,marginRight:8}}>
                <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',marginBottom:2}}>
                  <Tag bg="#f0f0ea">{modeLab[op.mode]||op.mode}</Tag>
                  {op.clientName&&<Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag>}
                </div>
                <div style={{fontSize:12,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail||'Sin detalle'}</div>
                <div style={{fontSize:10,color:'#bbb'}}>{fmtDT(op.createdAt)}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                {op.legs?.filter(l=>l.kind==='account'&&l.delta<0).map(l=><div key={l.id} style={{fontSize:11,color:'#dc2626'}}>-{fmt(Math.abs(l.delta),l.cur)}</div>)}
                {op.legs?.filter(l=>l.kind==='account'&&l.delta>0).map(l=><div key={l.id} style={{fontSize:11,color:'#16a34a'}}>+{fmt(l.delta,l.cur)}</div>)}
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
function Operaciones({accounts,clients,credits,ops,onAddOp,onEditOp,onDeleteOp}){
  const mobile=useIsMobile()
  const [open,setOpen]=useState(false),[editOp,setEdit]=useState(null)
  const [confirmId,setConfirmId]=useState(null)
  const [q,setQ]=useState(''),[page,setPage]=useState(1)
  const PER=15
  const accMap=useMemo(()=>{const m={};accounts.forEach(a=>{m[a.id]=a});return m},[accounts])
  const visible=ops.filter(o=>!o.isReversal)
  const filtered=useMemo(()=>[...visible].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).filter(o=>!q||[o.detail,o.clientName].some(s=>(s||'').toLowerCase().includes(q.toLowerCase()))),[visible,q])
  const pages=Math.ceil(filtered.length/PER)||1,paged=filtered.slice((page-1)*PER,page*PER)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}
  const modeBg={exchange:'#e0f2fe',credit_out:'#fef9c3',credit_in:'#dcfce7',transfer:'#f5f3ff'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?18:22}}>Operaciones</h2>
        <Btn primary onClick={()=>{setEdit(null);setOpen(true)}}>+ Nueva</Btn>
      </div>
      <Modal open={open} onClose={()=>{setOpen(false);setEdit(null)}} title={editOp?'Editar operación':'Nueva operación'}>
        <OpForm accounts={accounts} clients={clients} credits={credits} editOp={editOp} onSubmit={(op,orig)=>orig?onEditOp(op,orig):onAddOp(op)} onClose={()=>{setOpen(false);setEdit(null)}}/>
      </Modal>
      <Confirm open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={()=>onDeleteOp(confirmId)} message="Se eliminará la operación y su impacto en los saldos se revertirá automáticamente."/>
      <input placeholder="Buscar..." value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} style={{padding:'8px 12px',border:'1.5px solid #e0e0da',borderRadius:10,fontSize:13,background:'#fff'}}/>

      {mobile
        ?<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {paged.length===0
            ?<div style={{textAlign:'center',color:'#ccc',padding:'2rem'}}>Sin operaciones</div>
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
                  {op.detail&&<div style={{fontSize:12,color:'#888',marginBottom:6}}>{op.detail}</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      {out.map(l=><div key={l.id} style={{fontSize:12,color:'#dc2626',fontWeight:700}}>-{fmt(Math.abs(l.delta),l.cur)}</div>)}
                      {inA.map(l=><div key={l.id} style={{fontSize:12,color:'#16a34a',fontWeight:700}}>+{fmt(l.delta,l.cur)}</div>)}
                      {inC.map(l=><div key={l.id} style={{fontSize:12,color:'#b45309',fontWeight:700}}>💳 {fmt(l.delta,l.cur)}</div>)}
                    </div>
                    <div style={{textAlign:'right'}}>
                      {op.profit!=null&&<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{(op.profit>=0?'+':'')+fmt(op.profit,'USD')}</Tag>}
                      <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{fmtDT(op.createdAt)}</div>
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
                  ?<tr><td colSpan={6} style={{padding:'3rem',textAlign:'center',color:'#ccc'}}>Sin operaciones</td></tr>
                  :paged.map(op=>{
                    const out=op.legs?.filter(l=>l.delta<0)||[],inA=op.legs?.filter(l=>l.kind==='account'&&l.delta>0)||[],inC=op.legs?.filter(l=>l.kind==='credit'&&l.delta>0)||[]
                    return (
                      <tr key={op.id}>
                        <td style={{...TD_S,fontSize:10,color:'#aaa',whiteSpace:'nowrap'}}>{fmtDT(op.createdAt)}</td>
                        <td style={TD_S}>
                          <Tag bg={modeBg[op.mode]||'#f0f0ea'}>{modeLab[op.mode]||'—'}</Tag>
                          {op.clientName&&<div style={{marginTop:3}}><Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag></div>}
                          {op.detail&&<div style={{fontSize:10,color:'#aaa',marginTop:2,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail}</div>}
                        </td>
                        <td style={{...TD_S,whiteSpace:'nowrap'}}>
                          {out.map(l=><div key={l.id}><div style={{color:'#dc2626',fontWeight:700}}>-{fmt(Math.abs(l.delta),l.cur)}</div>{l.kind==='account'&&<div style={{fontSize:10,color:'#aaa'}}>{accMap[l.accId]?.name||'—'}</div>}</div>)}
                        </td>
                        <td style={{...TD_S,whiteSpace:'nowrap'}}>
                          {inA.map(l=><div key={l.id}><div style={{color:'#16a34a',fontWeight:700}}>+{fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:'#aaa'}}>{accMap[l.accId]?.name||'—'}</div></div>)}
                          {inC.map(l=><div key={l.id}><div style={{color:'#b45309',fontWeight:700}}>💳 {fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:'#aaa'}}>Crédito: {l.clientName}</div></div>)}
                        </td>
                        <td style={TD_S}>{op.profit!=null?<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{(op.profit>=0?'+':'')+fmt(op.profit,'USD')}</Tag>:'—'}</td>
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
          <span style={{fontSize:12,color:'#888'}}>Pág {page}/{pages}</span>
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
  const inRange=cOps.filter(o=>o.createdAt.slice(0,10)>=df&&o.createdAt.slice(0,10)<=dt)
  const totalP=cOps.reduce((s,o)=>s+(o.profit||0),0)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:10}}>
        <div style={{background:'#f0f9ff',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:10,fontWeight:800,color:'#0369a1',textTransform:'uppercase',marginBottom:3}}>Operaciones</div><div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{cOps.length}</div></div>
        <div style={{background:totalP>=0?'#f0fdf4':'#fef2f2',borderRadius:12,padding:'10px 12px'}}><div style={{fontSize:10,fontWeight:800,color:totalP>=0?'#166534':'#991b1b',textTransform:'uppercase',marginBottom:3}}>Profit total</div><div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif",color:totalP>=0?'#16a34a':'#dc2626'}}>{(totalP>=0?'+':'')+fmt(totalP,'USD')}</div></div>
        {openCr.length>0&&<div style={{background:'#fffbeb',borderRadius:12,padding:'10px 12px',border:'1.5px solid #fcd34d'}}><div style={{fontSize:10,fontWeight:800,color:'#b45309',textTransform:'uppercase',marginBottom:3}}>Me debe</div>{openCr.map(([cur,v])=><div key={cur} style={{fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",color:'#b45309',wordBreak:'break-all'}}>{fmt(v,cur)}</div>)}</div>}
      </div>
      <G2 stack={mobile}><Inp label="Desde" type="date" value={df} onChange={e=>setDf(e.target.value)}/><Inp label="Hasta" type="date" value={dt} onChange={e=>setDt(e.target.value)}/></G2>
      <div style={{overflowX:'auto',borderRadius:12,border:'1.5px solid #e8e8e2'}}>
        <table style={{borderCollapse:'collapse',width:'100%',minWidth:380}}>
          <thead><tr>{['Fecha','Tipo','Detalle','Sale','Entra'].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
          <tbody>
            {inRange.length===0
              ?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'#ccc'}}>Sin operaciones en este período</td></tr>
              :inRange.map(op=>{
                const out=op.legs?.filter(l=>l.delta<0)||[],inL=op.legs?.filter(l=>l.delta>0)||[]
                return (
                  <tr key={op.id}>
                    <td style={{...TD_S,color:'#aaa',whiteSpace:'nowrap',fontSize:10}}>{fmtD(op.createdAt)}</td>
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
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()))

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
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:mobile?18:22}}>Clientes</h2>
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
      <input placeholder="Buscar cliente..." value={q} onChange={e=>setQ(e.target.value)} style={{padding:'8px 12px',border:'1.5px solid #e0e0da',borderRadius:10,fontSize:13,background:'#fff'}}/>
      {filtered.length===0&&<div style={{color:'#aaa',fontSize:13,padding:'1rem 0'}}>No hay clientes. Creá el primero ↑</div>}
      <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
        {filtered.map(c=>{
          const cOps=clientOps(c.id,ops),profit=cOps.reduce((s,o)=>s+(o.profit||0),0)
          const creds=cliCreds(c.id,credits),openCr=Object.entries(creds).filter(([,v])=>v>0)
          const color=cliColor(c.name)
          return (
            <Card key={c.id} onClick={()=>setSel(c)} style={{borderTop:'4px solid '+color}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                  <div style={{width:34,height:34,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,fontFamily:"'Syne',sans-serif",flexShrink:0}}>{c.name.slice(0,2)}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,fontFamily:"'Syne',sans-serif",overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                    <div style={{fontSize:11,color:'#888'}}>{cOps.length} operaciones</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:4,flexShrink:0,marginLeft:8}} onClick={e=>e.stopPropagation()}>
                  <Btn small onClick={e=>openEdit(c,e)}>✏</Btn>
                  <Btn small danger onClick={e=>{e.stopPropagation();setConfirmId(c.id)}}>🗑</Btn>
                </div>
              </div>
              {openCr.length>0&&(
                <div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'5px 10px',marginBottom:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#b45309',marginBottom:1}}>DEBE</div>
                  {openCr.map(([cur,v])=><div key={cur} style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:13,color:'#b45309',wordBreak:'break-all'}}>{fmt(v,cur)+' '+cur}</div>)}
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'#f8f8f4',borderRadius:8}}>
                <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'}}>Profit</span>
                <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14,color:profit>=0?'#16a34a':'#dc2626'}}>{(profit>=0?'+':'')+fmt(profit,'USD')}</span>
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
  const visibleAccounts = filterTitular==='todos' ? accounts : accounts.filter(a=>a.titular===filterTitular)

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

      {/* Titular filter */}
      {titulares.length>1&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['todos',...titulares].map(t=>(
            <button key={t} onClick={()=>setFilterTitular(t)} style={{background:filterTitular===t?'#0f0f0f':'#f0f0ea',color:filterTitular===t?'#fff':'#555',border:'none',borderRadius:20,padding:'4px 12px',cursor:'pointer',fontSize:12,fontWeight:filterTitular===t?700:400,fontFamily:"'Syne',sans-serif"}}>
              {t==='todos'?'Todos':t}
            </button>
          ))}
        </div>
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
                        <div style={{fontSize:10,color:'#aaa'}}>{acc.titular?acc.titular+' · ':''}{acc.currency}</div>
                      </div>
                      <div style={{display:'flex',gap:3,flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();openEdit(acc,e)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,padding:2,color:'#aaa'}}>✏</button>
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
                      <div style={{fontSize:9,color:'#bbb'}}>Ver historial →</div>
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
        <div style={{marginTop:8,fontSize:12,color:'#888'}}>{inRange.length} operaciones en el período</div>
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
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Volumen operado</div>
          {Object.keys(vol).length===0?<div style={{fontSize:12,color:'#ccc'}}>Sin operaciones</div>:Object.entries(vol).map(([cur,v])=>(
            <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0f0ea'}}>
              <Tag>{cur}</Tag><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14}}>{fmt(v,cur)}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Profit por cliente</div>
          {pByCli.length===0?<div style={{fontSize:12,color:'#ccc'}}>Sin datos</div>:pByCli.map(({name,profit:p,ops:n})=>(
            <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #f0f0ea'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                <div style={{width:20,height:20,borderRadius:'50%',background:cliColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,flexShrink:0}}>{name.slice(0,2)}</div>
                <div style={{minWidth:0}}><div style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</div><div style={{fontSize:10,color:'#aaa'}}>{n} ops</div></div>
              </div>
              <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:13,color:p>=0?'#16a34a':'#dc2626',flexShrink:0,marginLeft:8}}>{(p>=0?'+':'')+fmt(p,'USD')}</span>
            </div>
          ))}
        </Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:cols,gap:14}}>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Saldos actuales</div>
          {ACC_TYPES.map(type=>{
            const ent=Object.entries(accS[type]||{})
            return (
              <div key={type} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc',flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span>
                </div>
                {ent.length===0
                  ?<div style={{fontSize:11,color:'#ccc',paddingLeft:12}}>$0</div>
                  :ent.map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'1px 0 1px 9px',borderLeft:'2px solid '+(ACC_COLOR[type]||'#eee')}}>
                      <span style={{fontSize:12,color:'#888'}}>{cur}</span>
                      <span style={{fontSize:12,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </Card>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Créditos abiertos</div>
          {Object.keys(allCr).length===0
            ?<div style={{textAlign:'center',padding:'12px 0'}}><div style={{fontSize:22}}>✓</div><div style={{fontSize:12,color:'#888',marginTop:3}}>Sin créditos</div></div>
            :Object.entries(allCr).map(([cur,v])=>(
              <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f0f0ea'}}>
                <Tag bg="#fef9c3" color="#b45309">{cur}</Tag>
                <span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14,color:'#b45309'}}>{fmt(v,cur)}</span>
              </div>
            ))
          }
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
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:14}}>Saldo por titular</div>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
              {byTitular.map(({tit,byCur,totalUSD})=>(
                <div key={tit} style={{background:'#f8f8f4',borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,marginBottom:8}}>{tit}</div>
                  {Object.entries(byCur).map(([cur,val])=>(
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}>
                      <span style={{fontSize:11,color:'#888'}}>{cur}</span>
                      <span style={{fontSize:12,fontWeight:600,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #e8e8e2',marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:700}}>Total USD</span>
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

  return (
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif",flexDirection:mobile?'column':'row'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{background:#f4f4f0}`}</style>
      <Sidebar tab={tab} setTab={setTab} profile={profile} signOut={signOut} mobile={mobile}/>
      <main style={{flex:1,padding:mobile?'12px 12px 80px':'24px 28px',overflowY:'auto',overflowX:'hidden',maxWidth:'100%'}}>
        {tab==='Dashboard'  &&<Dashboard   accounts={accounts} clients={clients} ops={ops} credits={credits} setTab={setTab}/>}
        {tab==='Operaciones'&&<Operaciones accounts={accounts} clients={clients} credits={credits} ops={ops}
          onAddOp={op=>run(()=>addOperation(op),refetchOps,refetchAccounts,refetchCredits)}
          onEditOp={(op,orig)=>run(()=>editOperation(op,orig),refetchOps,refetchAccounts,refetchCredits)}
          onDeleteOp={id=>run(()=>deleteOperation(id),refetchOps,refetchAccounts,refetchCredits)}
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
