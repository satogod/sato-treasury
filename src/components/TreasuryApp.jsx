import { useState, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  useAccounts, useClients, useOperations, useCreditBalances,
  addOperation, editOperation, addClient, addAccount, updateAccountOpeningBal,
} from '../hooks/useData'

const CURRENCIES = ['USD','PYG','USDT','BRL','EUR']
const ACC_TYPES  = ['Efectivo','Banco','Wallet Crypto','Broker/Plataforma']
const USD_RATE   = {USD:1,USDT:1,PYG:1/6200,BRL:1/5.1,EUR:1.08}
const toUSD      = (v,c) => v * (USD_RATE[c] || 1)
const ACC_COLOR  = {Efectivo:'#fde047',Banco:'#93c5fd','Wallet Crypto':'#6ee7b7','Broker/Plataforma':'#c4b5fd'}
const CLI_PAL    = ['#fde047','#f9a8d4','#86efac','#93c5fd','#fdba74','#d8b4fe','#67e8f9','#fca5a5']
const cliColor   = n => CLI_PAL[(n||'X').charCodeAt(0) % CLI_PAL.length]

const FMT = {
  USD:  v => '$'  + Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
  PYG:  v => '₲'  + Math.abs(v).toLocaleString('es-PY',{maximumFractionDigits:0}),
  USDT: v =>        Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' USDT',
  BRL:  v => 'R$' + Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),
  EUR:  v => '€'  + Math.abs(v).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}),
}
const fmt   = (v,c) => { if(v===null||v===undefined||isNaN(v))return'—';const fn=FMT[c]||(x=>Math.abs(x).toFixed(2)+' '+c);return(v<0?'-':'')+fn(v) }
const fmtD  = iso => new Date(iso).toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'2-digit'})
const fmtDT = iso => new Date(iso).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
const uid   = () => Math.random().toString(36).slice(2,9)

const accBal = acc => Number(acc.balance ?? acc.opening_bal ?? 0)
const accSummaryByType = accounts => {
  const g={};ACC_TYPES.forEach(t=>{g[t]={}})
  accounts.forEach(a=>{const b=accBal(a);if(!g[a.type])g[a.type]={};g[a.type][a.currency]=(g[a.type][a.currency]||0)+b})
  return g
}
const clientCreditBals = (clientId, credits) => {
  const b={}
  credits.filter(c=>c.client_id===clientId).forEach(c=>{b[c.currency]=Number(c.balance)})
  return b
}
const allCreditsByType = credits => {
  const b={}
  credits.filter(c=>Number(c.balance)>0).forEach(c=>{b[c.currency]=(b[c.currency]||0)+Number(c.balance)})
  return b
}
const globalNetWorth = (accounts,credits) => {
  let t=accounts.reduce((s,a)=>s+toUSD(accBal(a),a.currency),0)
  credits.forEach(c=>{t+=toUSD(Number(c.balance),c.currency)})
  return t
}
const clientOpsAll = (clientId,ops) =>
  ops.filter(o=>o.clientId===clientId&&!o.isReversal).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))

const Card    = ({children,style,onClick}) => <div onClick={onClick} style={{background:'#fff',border:'1.5px solid #e8e8e2',borderRadius:16,padding:'16px 18px',cursor:onClick?'pointer':undefined,...style}}>{children}</div>
const Btn     = ({children,onClick,primary,small,disabled,style}) => <button onClick={onClick} disabled={disabled} style={{background:primary?'#0f0f0f':'#fff',color:primary?'#fff':'#0f0f0f',border:primary?'none':'1.5px solid #e0e0da',borderRadius:10,padding:small?'5px 11px':'8px 16px',fontWeight:600,fontSize:small?11:13,fontFamily:"'Syne',sans-serif",cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,...style}}>{children}</button>
const Tag     = ({children,bg,color}) => <span style={{display:'inline-flex',padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:bg||'#f0f0ea',color:color||'#0f0f0f',fontFamily:"'Syne',sans-serif"}}>{children}</span>
const iStyle  = {width:'100%',boxSizing:'border-box',background:'#fff',border:'1.5px solid #e0e0da',borderRadius:10,padding:'8px 12px',fontSize:13,fontFamily:"'DM Sans',sans-serif"}
const Fld     = ({label,children,hint}) => <div style={{display:'flex',flexDirection:'column',gap:4}}>{label&&<label style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>}{children}{hint&&<div style={{fontSize:10,color:'#aaa',marginTop:2}}>{hint}</div>}</div>
const Inp     = ({label,hint,...p}) => <Fld label={label} hint={hint}><input style={iStyle} {...p}/></Fld>
const SelEl   = ({label,children,...p}) => <Fld label={label}><select style={iStyle} {...p}>{children}</select></Fld>
const G2      = ({children,gap}) => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:gap||12}}>{children}</div>
const Divider = () => <div style={{borderTop:'1.5px dashed #e8e8e2',margin:'4px 0'}}/>
const TH_S    = {padding:'8px 12px',textAlign:'left',fontWeight:800,fontSize:10,color:'#888',background:'#f8f8f4',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap',fontFamily:"'Syne',sans-serif"}
const TD_S    = {padding:'8px 12px',borderBottom:'1px solid #f4f4f0',fontSize:12,verticalAlign:'middle'}

function Modal({open,onClose,title,children,wide}){
  if(!open)return null
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fafaf8',borderRadius:20,padding:24,width:wide?'min(720px,96vw)':'min(580px,96vw)',maxHeight:'92vh',overflowY:'auto',border:'2px solid #0f0f0f'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999'}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function OpForm({state,dispatch,onClose,editOp}){
  const{accounts,clients}=state
  const[mode,setMode]=useState(editOp?.mode||'exchange')
  const initF=()=>{
    if(editOp){
      const o=editOp.legs?.find(l=>l.delta<0)
      const ia=editOp.legs?.find(l=>l.kind==='account'&&l.delta>0)
      const ic=editOp.legs?.find(l=>l.kind==='credit'&&l.delta>0)
      return{date:editOp.createdAt.slice(0,16),fromAccId:o?.accId||accounts[0]?.id,fromAmt:String(Math.abs(o?.delta||0)||''),toAccId:ia?.accId||accounts[0]?.id,toAmt:String(ia?.delta||''),clientId:editOp.clientId||'',creditCur:ic?.cur||o?.cur||'USD',creditAmt:String(Math.abs(ic?.delta||0)||''),rate:editOp.rate?String(editOp.rate):'',detail:editOp.detail||''}
    }
    return{date:new Date().toISOString().slice(0,16),fromAccId:accounts.find(a=>a.currency==='USDT')?.id||accounts[0]?.id,fromAmt:'',toAccId:accounts.find(a=>a.currency==='USD'&&a.type==='Efectivo')?.id||accounts[0]?.id,toAmt:'',clientId:clients[0]?.id||'',creditCur:'USD',creditAmt:'',rate:'',detail:''}
  }
  const[f,sf]=useState(initF)
  const set=(k,v)=>sf(x=>({...x,[k]:v}))
  const fromAcc=accounts.find(a=>a.id===f.fromAccId)
  const toAcc=accounts.find(a=>a.id===f.toAccId)
  const client=clients.find(c=>c.id===f.clientId)
  const existingCredits=useMemo(()=>f.clientId?clientCreditBals(f.clientId,state.credits):{},[f.clientId,state.credits])
  const autoProfit=useMemo(()=>{
    if(mode==='transfer')return null
    const fa=parseFloat(f.fromAmt),ta=parseFloat(mode==='credit_out'?f.creditAmt:f.toAmt)
    const toCur=mode==='credit_out'?f.creditCur:(toAcc?.currency||'USD')
    if(!fa||!ta)return null
    return+(toUSD(ta,toCur)-toUSD(fa,fromAcc?.currency||'USD')).toFixed(2)
  },[mode,f,fromAcc,toAcc])
  const submit=async()=>{
    const fa=parseFloat(f.fromAmt)||0,ta=parseFloat(f.toAmt)||0,ca=parseFloat(f.creditAmt)||0
    const legs=[]
    if(mode==='exchange'){if(!fa||!ta){alert('Ingresá ambos montos');return};legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa});legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta})}
    else if(mode==='credit_out'){if(!fa||!ca){alert('Ingresá ambos montos');return};if(!f.clientId){alert('Seleccioná un cliente');return};legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa});legs.push({id:uid(),kind:'credit',clientId:f.clientId,clientName:client?.name,cur:f.creditCur,delta:ca})}
    else if(mode==='credit_in'){if(!ca||!ta){alert('Ingresá ambos montos');return};if(!f.clientId){alert('Seleccioná un cliente');return};legs.push({id:uid(),kind:'credit',clientId:f.clientId,clientName:client?.name,cur:f.creditCur,delta:-ca});legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta})}
    else if(mode==='transfer'){if(!fa){alert('Ingresá el monto');return};legs.push({id:uid(),kind:'account',accId:f.fromAccId,cur:fromAcc?.currency,delta:-fa});legs.push({id:uid(),kind:'account',accId:f.toAccId,cur:toAcc?.currency,delta:ta||fa})}
    const op={createdAt:new Date(f.date).toISOString(),detail:f.detail,mode,clientId:f.clientId||null,clientName:client?.name||null,rate:parseFloat(f.rate)||null,profit:autoProfit,legs}
    await dispatch(editOp?{type:'EDIT_OP',op,originalOp:editOp}:{type:'ADD_OP',op})
    onClose()
  }
  const accOpts=accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)
  const cliOpts=clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)
  const MODES=[{k:'exchange',label:'Cambio cerrado',icon:'⇄',desc:'El cliente paga en el momento'},{k:'credit_out',label:'Crédito dado',icon:'📤',desc:'Le enviás, te queda debiendo'},{k:'credit_in',label:'Cobro de deuda',icon:'📥',desc:'El cliente salda su deuda'},{k:'transfer',label:'Transferencia interna',icon:'↔',desc:'Entre tus propias cuentas'}]
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {MODES.map(m=><button key={m.k} onClick={()=>setMode(m.k)} style={{background:mode===m.k?'#0f0f0f':'#f8f8f4',color:mode===m.k?'#fff':'#555',border:`1.5px solid ${mode===m.k?'#0f0f0f':'#e8e8e2'}`,borderRadius:12,padding:'10px 12px',cursor:'pointer',textAlign:'left'}}><div style={{fontSize:16,marginBottom:2}}>{m.icon}</div><div style={{fontWeight:700,fontSize:12,fontFamily:"'Syne',sans-serif"}}>{m.label}</div><div style={{fontSize:10,opacity:.7,marginTop:1}}>{m.desc}</div></button>)}
      </div>
      <Divider/>
      <Inp label="Fecha y hora" type="datetime-local" value={f.date} onChange={e=>set('date',e.target.value)}/>
      {mode==='exchange'&&<>
        <div style={{background:'#fff5f5',border:'1.5px solid #fecaca',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#dc2626',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📤 Sale de tu cuenta</div><G2><SelEl label="Cuenta" value={f.fromAccId} onChange={e=>set('fromAccId',e.target.value)}>{accOpts}</SelEl><Inp label={`Monto (${fromAcc?.currency||'—'})`} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/></G2></div>
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#16a34a',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📥 Entra a tu cuenta</div><G2><SelEl label="Cuenta" value={f.toAccId} onChange={e=>set('toAccId',e.target.value)}>{accOpts}</SelEl><Inp label={`Monto (${toAcc?.currency||'—'})`} type="number" placeholder="0.00" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/></G2></div>
        <SelEl label="Cliente contraparte (opcional)" value={f.clientId} onChange={e=>set('clientId',e.target.value)}><option value="">— Sin cliente —</option>{cliOpts}</SelEl>
      </>}
      {mode==='credit_out'&&<>
        <div style={{background:'#fff5f5',border:'1.5px solid #fecaca',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#dc2626',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📤 Lo que enviás (sale de tu cuenta)</div><G2><SelEl label="Tu cuenta" value={f.fromAccId} onChange={e=>set('fromAccId',e.target.value)}>{accOpts}</SelEl><Inp label={`Monto (${fromAcc?.currency||'—'})`} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/></G2></div>
        <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#b45309',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>💳 Lo que el cliente te queda debiendo</div><SelEl label="Cliente" value={f.clientId} onChange={e=>set('clientId',e.target.value)}>{cliOpts}</SelEl><G2 gap={8}><Inp label="Monto que te debe" type="number" placeholder="0.00" value={f.creditAmt} onChange={e=>set('creditAmt',e.target.value)}/><SelEl label="Moneda" value={f.creditCur} onChange={e=>set('creditCur',e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</SelEl></G2>{Object.entries(existingCredits).filter(([,v])=>v>0).length>0&&<div style={{marginTop:8,fontSize:11,color:'#b45309'}}>Deuda actual: {Object.entries(existingCredits).filter(([,v])=>v>0).map(([c,v])=>fmt(v,c)).join(' / ')}</div>}</div>
      </>}
      {mode==='credit_in'&&<>
        <SelEl label="Cliente que paga" value={f.clientId} onChange={e=>set('clientId',e.target.value)}>{cliOpts}</SelEl>
        {Object.entries(existingCredits).filter(([,v])=>v>0).length>0&&<div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:10,padding:'10px 14px',fontSize:12}}><div style={{fontWeight:700,marginBottom:4,color:'#b45309'}}>Deuda pendiente:</div>{Object.entries(existingCredits).filter(([,v])=>v>0).map(([c,v])=><div key={c} style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'#888'}}>{c}</span><span style={{fontWeight:700}}>{fmt(v,c)}</span></div>)}</div>}
        <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#b45309',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>💳 Deuda que se cancela</div><G2 gap={8}><Inp label="Monto que paga" type="number" placeholder="0.00" value={f.creditAmt} onChange={e=>set('creditAmt',e.target.value)}/><SelEl label="Moneda" value={f.creditCur} onChange={e=>set('creditCur',e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</SelEl></G2></div>
        <div style={{background:'#f0fdf4',border:'1.5px solid #86efac',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#16a34a',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>📥 Entra a tu cuenta</div><G2><SelEl label="Cuenta" value={f.toAccId} onChange={e=>set('toAccId',e.target.value)}>{accOpts}</SelEl><Inp label={`Monto (${toAcc?.currency||'—'})`} type="number" placeholder="0.00" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/></G2></div>
      </>}
      {mode==='transfer'&&<div style={{background:'#f5f3ff',border:'1.5px solid #c4b5fd',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:11,fontWeight:800,color:'#7c3aed',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>↔ Entre tus cuentas</div><G2><SelEl label="Origen" value={f.fromAccId} onChange={e=>set('fromAccId',e.target.value)}>{accOpts}</SelEl><SelEl label="Destino" value={f.toAccId} onChange={e=>set('toAccId',e.target.value)}>{accOpts}</SelEl></G2><G2><Inp label={`Sale (${fromAcc?.currency||'—'})`} type="number" placeholder="0.00" value={f.fromAmt} onChange={e=>set('fromAmt',e.target.value)}/><Inp label={`Entra (${toAcc?.currency||'—'})`} type="number" placeholder="igual si misma moneda" value={f.toAmt} onChange={e=>set('toAmt',e.target.value)}/></G2></div>}
      <Inp label="Cotización (opcional)" type="number" placeholder="ej: 6200" value={f.rate} onChange={e=>set('rate',e.target.value)}/>
      <Inp label="Detalle / Comentario" placeholder="Descripción de la operación" value={f.detail} onChange={e=>set('detail',e.target.value)}/>
      {autoProfit!==null&&<div style={{background:autoProfit>=0?'#f0fdf4':'#fef2f2',border:`1.5px solid ${autoProfit>=0?'#86efac':'#fca5a5'}`,borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:12,fontWeight:600,color:'#666'}}>Profit/Loss estimado (USD)</span><span style={{fontWeight:800,fontSize:18,fontFamily:"'Syne',sans-serif",color:autoProfit>=0?'#16a34a':'#dc2626'}}>{autoProfit>=0?'+':''}{fmt(autoProfit,'USD')}</span></div>}
      <div style={{fontSize:10,color:'#aaa',textAlign:'center'}}>Ref: 1 USDT=$1 · 1 EUR=$1.08 · ₲6200=$1 · R$5.1=$1</div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}><Btn onClick={onClose}>Cancelar</Btn><Btn primary onClick={submit}>{editOp?'Guardar cambios':'Registrar operación'}</Btn></div>
    </div>
  )
}

function AccDetail({acc,ops,dispatch}){
  const[editOB,setEditOB]=useState(false)
  const[newOB,setNewOB]=useState(String(acc.opening_bal||0))
  const accOps=useMemo(()=>{const rows=[];ops.filter(o=>!o.isReversal).forEach(o=>{(o.legs||[]).filter(l=>l.kind==='account'&&l.accId===acc.id).forEach(l=>{rows.push({id:l.id,date:o.createdAt,detail:o.detail,delta:l.delta,clientName:o.clientName,mode:o.mode})})});return rows.sort((a,b)=>new Date(a.date)-new Date(b.date))},[ops,acc.id])
  const saveOB=()=>{dispatch({type:'UPDATE_ACC',acc:{...acc,openingBal:parseFloat(newOB)||0}});setEditOB(false)}
  const modeLab={exchange:'Cambio',credit_out:'Crédito',credit_in:'Cobro',transfer:'Transfer.'}
  let running=Number(acc.opening_bal||0)
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <div style={{background:ACC_COLOR[acc.type]||'#f0f0ea',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{acc.type}</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(accBal(acc),acc.currency)}</div></div>
        <div style={{background:'#f8f8f4',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,color:'#888'}}>Saldo inicial</div>{editOB?<div style={{display:'flex',gap:6,alignItems:'center'}}><input type="number" value={newOB} onChange={e=>setNewOB(e.target.value)} style={{width:100,padding:'4px 8px',borderRadius:8,border:'1.5px solid #ccc',fontSize:13}}/><Btn primary small onClick={saveOB}>✓</Btn><Btn small onClick={()=>setEditOB(false)}>✕</Btn></div>:<div style={{display:'flex',alignItems:'center',gap:8}}><div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(acc.opening_bal||0,acc.currency)}</div><Btn small onClick={()=>setEditOB(true)}>✏</Btn></div>}</div>
        <div style={{background:'#f8f8f4',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4,color:'#888'}}>Movimientos</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{accOps.length}</div></div>
      </div>
      <div style={{background:'#fff',border:'1.5px solid #e8e8e2',borderRadius:12,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr>{['Fecha','Tipo','Detalle','Movimiento','Balance'].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
            <tbody>
              <tr style={{background:'#fafaf8'}}><td style={{...TD_S,fontSize:10,color:'#aaa'}}>—</td><td style={TD_S}><Tag>Inicial</Tag></td><td style={TD_S}>Saldo inicial</td><td style={{...TD_S,fontWeight:700,color:'#888'}}>{fmt(acc.opening_bal||0,acc.currency)}</td><td style={{...TD_S,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{fmt(acc.opening_bal||0,acc.currency)}</td></tr>
              {accOps.length===0?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'#ccc'}}>Sin movimientos aún</td></tr>:accOps.map(row=>{running+=row.delta;const snap=running;return(<tr key={row.id}><td style={{...TD_S,fontSize:10,color:'#aaa',whiteSpace:'nowrap'}}>{fmtDT(row.date)}</td><td style={TD_S}><Tag>{modeLab[row.mode]||'—'}</Tag></td><td style={{...TD_S,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><div>{row.detail||'—'}</div>{row.clientName&&<div style={{fontSize:10,marginTop:2}}><Tag bg={cliColor(row.clientName)}>{row.clientName}</Tag></div>}</td><td style={{...TD_S,fontWeight:700,color:row.delta>=0?'#16a34a':'#dc2626',whiteSpace:'nowrap'}}>{row.delta>=0?'+':''}{fmt(row.delta,acc.currency)}</td><td style={{...TD_S,fontWeight:800,fontFamily:"'Syne',sans-serif",color:snap<0?'#dc2626':'#0f0f0f',whiteSpace:'nowrap'}}>{fmt(snap,acc.currency)}</td></tr>)})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const TABS=['Dashboard','Operaciones','Clientes','Cuentas','Reportes']
const T_ICO={Dashboard:'◉',Operaciones:'⇄',Clientes:'◈',Cuentas:'▣',Reportes:'◆'}
const T_COL={Dashboard:'#fde047',Operaciones:'#f9a8d4',Clientes:'#93c5fd',Cuentas:'#86efac',Reportes:'#c4b5fd'}

function Sidebar({tab,setTab,profile,signOut}){
  return(
    <div style={{width:175,minWidth:175,background:'#0f0f0f',display:'flex',flexDirection:'column',padding:'20px 0',position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'0 16px 20px',borderBottom:'1px solid #222'}}><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:'#fff',letterSpacing:'-0.02em'}}>SATO</div><div style={{fontSize:10,color:'#555',marginTop:2,letterSpacing:'0.1em'}}>TREASURY</div></div>
      <nav style={{display:'flex',flexDirection:'column',gap:2,padding:'14px 8px',flex:1}}>
        {TABS.map(t=><button key={t} onClick={()=>setTab(t)} style={{background:tab===t?T_COL[t]:'transparent',color:tab===t?'#0f0f0f':'#555',border:'none',borderRadius:10,padding:'9px 12px',cursor:'pointer',textAlign:'left',fontWeight:tab===t?700:400,fontSize:12,fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:13}}>{T_ICO[t]}</span>{t}</button>)}
      </nav>
      <div style={{padding:'12px 16px',borderTop:'1px solid #222'}}><div style={{fontSize:12,color:'#888',marginBottom:4}}>{profile?.name}</div><div style={{fontSize:10,color:'#555',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{profile?.role}</div><button onClick={signOut} style={{background:'none',border:'1px solid #333',borderRadius:8,padding:'5px 10px',color:'#666',fontSize:11,cursor:'pointer',width:'100%'}}>Cerrar sesión</button></div>
    </div>
  )
}

function Dashboard({state,setTab}){
  const{accounts,clients,ops,credits}=state
  const d=new Date()
  const visOps=ops.filter(o=>!o.isReversal)
  const pf=f=>visOps.filter(f).reduce((s,o)=>s+(o.profit||0),0)
  const today=pf(o=>new Date(o.createdAt).toDateString()===d.toDateString())
  const month=pf(o=>{const td=new Date(o.createdAt);return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear()})
  const recent=[...visOps].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5)
  const netWorth=useMemo(()=>globalNetWorth(accounts,credits),[accounts,credits])
  const myAccsUSD=useMemo(()=>accounts.reduce((s,a)=>s+toUSD(accBal(a),a.currency),0),[accounts])
  const creditsUSD=useMemo(()=>credits.reduce((s,c)=>s+toUSD(Number(c.balance),c.currency),0),[credits])
  const accSummary=useMemo(()=>accSummaryByType(accounts),[accounts])
  const creditSummary=useMemo(()=>{const m={};credits.filter(c=>Number(c.balance)>0).forEach(c=>{if(!m[c.client_id])m[c.client_id]={name:c.client_name,debts:[]};m[c.client_id].debts.push([c.currency,Number(c.balance)])});return Object.values(m)},[credits])
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div><h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,letterSpacing:'-0.03em'}}>Buenos días ☀</h1><p style={{color:'#888',fontSize:13,marginTop:4}}>{visOps.length} operaciones · {clients.length} clientes</p></div>
      <div style={{background:'#0f0f0f',borderRadius:20,padding:'20px 24px',color:'#fff'}}>
        <div style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em',color:'#555',marginBottom:8}}>Patrimonio neto total (USD)</div>
        <div style={{fontSize:36,fontWeight:800,fontFamily:"'Syne',sans-serif",letterSpacing:'-0.03em',color:netWorth>=0?'#86efac':'#fca5a5'}}>{netWorth>=0?'+':''}{fmt(netWorth,'USD')}</div>
        <div style={{display:'flex',gap:20,marginTop:12,flexWrap:'wrap'}}>
          <div><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em'}}>Mis cuentas</div><div style={{fontSize:16,fontWeight:700,color:'#93c5fd'}}>{fmt(myAccsUSD,'USD')}</div></div>
          <div><div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.05em'}}>Créditos activos</div><div style={{fontSize:16,fontWeight:700,color:creditsUSD>=0?'#86efac':'#fca5a5'}}>{creditsUSD>=0?'+':''}{fmt(creditsUSD,'USD')}</div></div>
        </div>
        <div style={{fontSize:10,color:'#333',marginTop:8}}>Cotizaciones de referencia: USDT=USD · EUR×1.08 · PYG÷6,200 · BRL÷5.1</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(148px,1fr))',gap:12}}>
        {[{l:'Ganancia hoy',v:fmt(today,'USD'),bg:'#fde047'},{l:'Ganancia mes',v:fmt(month,'USD'),bg:'#f9a8d4'},{l:'Créditos abiertos',v:creditSummary.length,bg:creditSummary.length>0?'#fca5a5':'#86efac'},{l:'Operaciones',v:visOps.length,bg:'#93c5fd'}].map(({l,v,bg})=><Card key={l} style={{background:bg,border:'none'}}><div style={{fontSize:10,fontWeight:800,fontFamily:"'Syne',sans-serif",marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>{l}</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{v}</div></Card>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Saldos por tipo</div>
          {ACC_TYPES.map(type=>{const ent=Object.entries(accSummary[type]||{}).filter(([,v])=>v!==0);return(<div key={type} style={{marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><div style={{width:8,height:8,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc'}}/><span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span></div>{ent.length===0?<div style={{fontSize:11,color:'#ccc',paddingLeft:14}}>$0</div>:ent.map(([cur,val])=><div key={cur} style={{display:'flex',justifyContent:'space-between',paddingLeft:10,borderLeft:`2px solid ${ACC_COLOR[type]||'#eee'}`,padding:'1px 0 1px 10px'}}><span style={{fontSize:12,color:'#888'}}>{cur}</span><span style={{fontSize:13,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span></div>)}</div>)})}
        </Card>
        <Card>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Créditos abiertos</div>
          {creditSummary.length===0?<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:24}}>✓</div><div style={{fontSize:12,color:'#888',marginTop:4}}>Sin créditos pendientes</div></div>:creditSummary.map(({name,debts},i)=><div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',marginBottom:6,background:'#fffbeb',borderRadius:10,border:'1px solid #fcd34d'}}><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:'50%',background:cliColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>{name.slice(0,2)}</div><span style={{fontWeight:600,fontSize:13}}>{name}</span></div><div style={{textAlign:'right'}}>{debts.map(([cur,v])=><div key={cur} style={{fontSize:13,fontWeight:700,color:'#b45309'}}>{fmt(v,cur)} {cur}</div>)}</div></div>)}
        </Card>
      </div>
      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14}}>Últimas operaciones</div><Btn small onClick={()=>setTab('Operaciones')}>Ver todas →</Btn></div>
        {recent.length===0?<div style={{fontSize:12,color:'#ccc',textAlign:'center',padding:'16px 0'}}>Sin operaciones aún</div>:recent.map(op=><div key={op.id} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid #f0f0ea'}}><div><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}><Tag bg="#f0f0ea">{modeLab[op.mode]||op.mode}</Tag>{op.clientName&&<Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag>}</div><div style={{fontSize:12,color:'#888',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail||'Sin detalle'}</div><div style={{fontSize:10,color:'#bbb'}}>{fmtDT(op.createdAt)}</div></div><div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>{op.legs?.filter(l=>l.kind==='account'&&l.delta<0).map(l=><div key={l.id} style={{fontSize:11,color:'#dc2626'}}>-{fmt(Math.abs(l.delta),l.cur)}</div>)}{op.legs?.filter(l=>l.kind==='account'&&l.delta>0).map(l=><div key={l.id} style={{fontSize:11,color:'#16a34a'}}>+{fmt(l.delta,l.cur)}</div>)}{op.legs?.filter(l=>l.kind==='credit'&&l.delta>0).map(l=><div key={l.id} style={{fontSize:11,color:'#b45309'}}>💳 {fmt(l.delta,l.cur)}</div>)}{op.profit!=null&&<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{op.profit>=0?'+':''}{fmt(op.profit,'USD')}</Tag>}</div></div>)}
      </Card>
    </div>
  )
}

function Operaciones({state,dispatch}){
  const{ops,accounts}=state
  const[open,setOpen]=useState(false)
  const[editOp,setEditOp]=useState(null)
  const[q,setQ]=useState('')
  const[page,setPage]=useState(1)
  const PER=15
  const accMap=useMemo(()=>{const m={};accounts.forEach(a=>{m[a.id]=a});return m},[accounts])
  const visible=ops.filter(o=>!o.isReversal)
  const filtered=useMemo(()=>[...visible].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).filter(o=>!q||[o.detail,o.clientName].some(s=>(s||'').toLowerCase().includes(q.toLowerCase()))),[visible,q])
  const pages=Math.ceil(filtered.length/PER)||1
  const paged=filtered.slice((page-1)*PER,page*PER)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}
  const modeBg={exchange:'#e0f2fe',credit_out:'#fef9c3',credit_in:'#dcfce7',transfer:'#f5f3ff'}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>Operaciones</h2>{dispatch&&<Btn primary onClick={()=>{setEditOp(null);setOpen(true)}}>+ Nueva operación</Btn>}</div>
      <Modal open={open} onClose={()=>{setOpen(false);setEditOp(null)}} title={editOp?'Editar operación':'Nueva operación'}><OpForm state={state} dispatch={dispatch} onClose={()=>{setOpen(false);setEditOp(null)}} editOp={editOp}/></Modal>
      <input placeholder="Buscar..." value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} style={{maxWidth:340,...iStyle}}/>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr>{['Fecha','Tipo / Cliente','Sale','Entra / Crédito','Profit',''].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
            <tbody>
              {paged.length===0?<tr><td colSpan={6} style={{padding:'3rem',textAlign:'center',color:'#ccc'}}>Sin operaciones</td></tr>:paged.map(op=>{
                const outLegs=op.legs?.filter(l=>l.delta<0)||[]
                const inAccLegs=op.legs?.filter(l=>l.kind==='account'&&l.delta>0)||[]
                const inCredLegs=op.legs?.filter(l=>l.kind==='credit'&&l.delta>0)||[]
                return(<tr key={op.id}>
                  <td style={{...TD_S,fontSize:10,color:'#aaa',whiteSpace:'nowrap'}}>{fmtDT(op.createdAt)}</td>
                  <td style={TD_S}><Tag bg={modeBg[op.mode]||'#f0f0ea'}>{modeLab[op.mode]||'—'}</Tag>{op.clientName&&<div style={{marginTop:4}}><Tag bg={cliColor(op.clientName)}>{op.clientName}</Tag></div>}{op.detail&&<div style={{fontSize:10,color:'#aaa',marginTop:2,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{op.detail}</div>}</td>
                  <td style={{...TD_S,whiteSpace:'nowrap'}}>{outLegs.map(l=><div key={l.id}><div style={{color:'#dc2626',fontWeight:700}}>-{fmt(Math.abs(l.delta),l.cur)}</div>{l.kind==='account'&&<div style={{fontSize:10,color:'#aaa'}}>{accMap[l.accId]?.name||'—'}</div>}</div>)}</td>
                  <td style={{...TD_S,whiteSpace:'nowrap'}}>{inAccLegs.map(l=><div key={l.id}><div style={{color:'#16a34a',fontWeight:700}}>+{fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:'#aaa'}}>{accMap[l.accId]?.name||'—'}</div></div>)}{inCredLegs.map(l=><div key={l.id}><div style={{color:'#b45309',fontWeight:700}}>💳 {fmt(l.delta,l.cur)}</div><div style={{fontSize:10,color:'#aaa'}}>Crédito: {l.clientName}</div></div>)}</td>
                  <td style={TD_S}>{op.profit!=null?<Tag bg={op.profit>=0?'#dcfce7':'#fee2e2'} color={op.profit>=0?'#166534':'#991b1b'}>{op.profit>=0?'+':''}{fmt(op.profit,'USD')}</Tag>:'—'}</td>
                  <td style={TD_S}>{dispatch&&<Btn small onClick={()=>{setEditOp(op);setOpen(true)}}>✏</Btn>}</td>
                </tr>)
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {pages>1&&<div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center'}}><Btn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</Btn><span style={{fontSize:12,color:'#888'}}>Pág {page}/{pages}</span><Btn onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}>›</Btn></div>}
    </div>
  )
}

function ClienteDetalle({client,state}){
  const{ops,accounts,credits}=state
  const d=new Date()
  const[df,setDf]=useState(new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10))
  const[dt,setDt]=useState(d.toISOString().slice(0,10))
  const accMap=useMemo(()=>{const m={};accounts.forEach(a=>{m[a.id]=a});return m},[accounts])
  const cOps=useMemo(()=>clientOpsAll(client.id,ops),[client.id,ops])
  const cliCr=useMemo(()=>clientCreditBals(client.id,credits),[client.id,credits])
  const openCr=Object.entries(cliCr).filter(([,v])=>v>0)
  const inRange=cOps.filter(o=>o.createdAt.slice(0,10)>=df&&o.createdAt.slice(0,10)<=dt)
  const totalProfit=cOps.reduce((s,o)=>s+(o.profit||0),0)
  const modeLab={exchange:'Cambio',credit_out:'Crédito dado',credit_in:'Cobro',transfer:'Transfer.'}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <div style={{background:'#f0f9ff',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:10,fontWeight:800,color:'#0369a1',textTransform:'uppercase',marginBottom:4}}>Operaciones</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{cOps.length}</div></div>
        <div style={{background:totalProfit>=0?'#f0fdf4':'#fef2f2',borderRadius:12,padding:'12px 14px'}}><div style={{fontSize:10,fontWeight:800,color:totalProfit>=0?'#166534':'#991b1b',textTransform:'uppercase',marginBottom:4}}>Profit total</div><div style={{fontSize:20,fontWeight:800,fontFamily:"'Syne',sans-serif",color:totalProfit>=0?'#16a34a':'#dc2626'}}>{totalProfit>=0?'+':''}{fmt(totalProfit,'USD')}</div></div>
        {openCr.length>0&&<div style={{background:'#fffbeb',borderRadius:12,padding:'12px 14px',border:'1.5px solid #fcd34d'}}><div style={{fontSize:10,fontWeight:800,color:'#b45309',textTransform:'uppercase',marginBottom:4}}>Me debe</div>{openCr.map(([cur,v])=><div key={cur} style={{fontSize:16,fontWeight:800,fontFamily:"'Syne',sans-serif",color:'#b45309'}}>{fmt(v,cur)} {cur}</div>)}</div>}
      </div>
      <G2><Inp label="Desde" type="date" value={df} onChange={e=>setDf(e.target.value)}/><Inp label="Hasta" type="date" value={dt} onChange={e=>setDt(e.target.value)}/></G2>
      <div style={{background:'#fff',border:'1.5px solid #e8e8e2',borderRadius:12,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table>
            <thead><tr>{['Fecha','Tipo','Detalle','Sale / Crédito','Entra'].map(x=><th key={x} style={TH_S}>{x}</th>)}</tr></thead>
            <tbody>
              {inRange.length===0?<tr><td colSpan={5} style={{padding:'2rem',textAlign:'center',color:'#ccc'}}>Sin operaciones en este período</td></tr>:inRange.map(op=>{
                const outLegs=op.legs?.filter(l=>l.delta<0)||[]
                const inLegs=op.legs?.filter(l=>l.delta>0)||[]
                return(<tr key={op.id}><td style={{...TD_S,color:'#aaa',whiteSpace:'nowrap',fontSize:10}}>{fmtD(op.createdAt)}</td><td style={TD_S}><Tag>{modeLab[op.mode]||'—'}</Tag></td><td style={{...TD_S,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{op.detail||'—'}</td><td style={TD_S}>{outLegs.map(l=><div key={l.id} style={{color:l.kind==='account'?'#dc2626':'#b45309',fontWeight:700,whiteSpace:'nowrap'}}>{l.kind==='credit'?'💳 ':'-'}{fmt(Math.abs(l.delta),l.cur)}{l.kind==='account'&&<span style={{fontSize:10,color:'#aaa',fontWeight:400,marginLeft:4}}>{accMap[l.accId]?.name}</span>}</div>)}</td><td style={TD_S}>{inLegs.map(l=><div key={l.id} style={{color:l.kind==='account'?'#16a34a':'#b45309',fontWeight:700,whiteSpace:'nowrap'}}>{l.kind==='credit'?'💳 ':'+'}{fmt(l.delta,l.cur)}{l.kind==='account'&&<span style={{fontSize:10,color:'#aaa',fontWeight:400,marginLeft:4}}>{accMap[l.accId]?.name}</span>}</div>)}</td></tr>)
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Clientes({state,dispatch}){
  const{clients,ops,credits}=state
  const[open,setOpen]=useState(false)
  const[sel,setSel]=useState(null)
  const[f,sf]=useState({name:'',phone:'',notes:''})
  const[q,setQ]=useState('')
  const filtered=clients.filter(c=>c.name.toLowerCase().includes(q.toLowerCase()))
  const submit=async()=>{if(!f.name.trim())return;await dispatch({type:'ADD_CLI',c:{...f}});sf({name:'',phone:'',notes:''});setOpen(false)}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>Clientes</h2>{dispatch&&<Btn primary onClick={()=>setOpen(true)}>+ Nuevo cliente</Btn>}</div>
      <Modal open={open} onClose={()=>setOpen(false)} title="Nuevo cliente"><div style={{display:'flex',flexDirection:'column',gap:12}}><Inp label="Nombre / Alias" value={f.name} onChange={e=>sf({...f,name:e.target.value})}/><Inp label="Teléfono" type="tel" value={f.phone} onChange={e=>sf({...f,phone:e.target.value})}/><Inp label="Observaciones" value={f.notes} onChange={e=>sf({...f,notes:e.target.value})}/><div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><Btn onClick={()=>setOpen(false)}>Cancelar</Btn><Btn primary onClick={submit}>Guardar</Btn></div></div></Modal>
      <Modal open={!!sel} onClose={()=>setSel(null)} title={sel?.name||''} wide>{sel&&<ClienteDetalle client={sel} state={state}/>}</Modal>
      <input placeholder="Buscar cliente..." value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:340,...iStyle}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12}}>
        {filtered.map(c=>{
          const cOps=clientOpsAll(c.id,ops)
          const profit=cOps.reduce((s,o)=>s+(o.profit||0),0)
          const cliCr=clientCreditBals(c.id,credits)
          const openCr=Object.entries(cliCr).filter(([,v])=>v>0)
          const color=cliColor(c.name)
          return(<Card key={c.id} onClick={()=>setSel(c)} style={{borderTop:`4px solid ${color}`}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><div style={{width:36,height:36,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{c.name.slice(0,2)}</div><div><div style={{fontWeight:700,fontSize:14,fontFamily:"'Syne',sans-serif"}}>{c.name}</div><div style={{fontSize:11,color:'#888'}}>{cOps.length} operaciones</div></div></div>
            {openCr.length>0&&<div style={{background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'6px 10px',marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:'#b45309',marginBottom:2}}>DEBE</div>{openCr.map(([cur,v])=><div key={cur} style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:14,color:'#b45309'}}>{fmt(v,cur)} {cur}</div>)}</div>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',background:'#f8f8f4',borderRadius:8}}><span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase'}}>Profit</span><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:15,color:profit>=0?'#16a34a':'#dc2626'}}>{profit>=0?'+':''}{fmt(profit,'USD')}</span></div>
          </Card>)
        })}
      </div>
    </div>
  )
}

function Cuentas({state,dispatch}){
  const{accounts,ops}=state
  const[open,setOpen]=useState(false)
  const[selAcc,setSelAcc]=useState(null)
  const[f,sf]=useState({name:'',type:'Efectivo',currency:'USD',titular:'',openingBal:0})
  const submit=async()=>{if(!f.name.trim())return;await dispatch({type:'ADD_ACC',a:{...f,openingBal:parseFloat(f.openingBal)||0}});sf({name:'',type:'Efectivo',currency:'USD',titular:'',openingBal:0});setOpen(false)}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>Cuentas internas</h2>{dispatch&&<Btn primary onClick={()=>setOpen(true)}>+ Nueva cuenta</Btn>}</div>
      <Modal open={open} onClose={()=>setOpen(false)} title="Nueva cuenta"><div style={{display:'flex',flexDirection:'column',gap:12}}><Inp label="Nombre" value={f.name} onChange={e=>sf({...f,name:e.target.value})}/><SelEl label="Tipo" value={f.type} onChange={e=>sf({...f,type:e.target.value})}>{ACC_TYPES.map(t=><option key={t}>{t}</option>)}</SelEl><SelEl label="Moneda" value={f.currency} onChange={e=>sf({...f,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</SelEl><Inp label="Titular" value={f.titular} onChange={e=>sf({...f,titular:e.target.value})}/><Inp label="Saldo inicial" type="number" placeholder="0.00" value={f.openingBal} onChange={e=>sf({...f,openingBal:e.target.value})} hint="Saldo con el que arranca esta cuenta"/><div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><Btn onClick={()=>setOpen(false)}>Cancelar</Btn><Btn primary onClick={submit}>Guardar</Btn></div></div></Modal>
      <Modal open={!!selAcc} onClose={()=>setSelAcc(null)} title={`${selAcc?.name||''} — Historial`} wide>{selAcc&&<AccDetail acc={selAcc} ops={ops} dispatch={dispatch}/>}</Modal>
      {ACC_TYPES.map(type=>{
        const accs=accounts.filter(a=>a.type===type);if(!accs.length)return null
        return(<div key={type}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><div style={{width:10,height:10,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc'}}/><span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:10}}>{accs.map(acc=><Card key={acc.id} onClick={()=>setSelAcc(acc)} style={{borderLeft:`4px solid ${ACC_COLOR[acc.type]||'#ccc'}`,cursor:'pointer'}}><div style={{fontWeight:700,fontSize:13,fontFamily:"'Syne',sans-serif",marginBottom:2}}>{acc.name}</div><div style={{fontSize:10,color:'#aaa',marginBottom:10}}>{acc.titular?acc.titular+' · ':''}{acc.currency}</div><div style={{fontSize:22,fontWeight:800,fontFamily:"'Syne',sans-serif",color:accBal(acc)<0?'#dc2626':'#0f0f0f'}}>{fmt(accBal(acc),acc.currency)}</div><div style={{fontSize:10,color:'#aaa',marginTop:4}}>Clic para ver historial →</div></Card>)}</div></div>)
      })}
    </div>
  )
}

function Reportes({state}){
  const{ops,credits,accounts}=state
  const d=new Date()
  const visOps=ops.filter(o=>!o.isReversal)
  const[df,setDf]=useState(new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10))
  const[dt,setDt]=useState(d.toISOString().slice(0,10))
  const[preset,setPreset]=useState('month')
  const applyPreset=p=>{
    setPreset(p);const now=new Date()
    if(p==='today'){setDf(now.toISOString().slice(0,10));setDt(now.toISOString().slice(0,10))}
    else if(p==='week'){const s=new Date(now);s.setDate(now.getDate()-6);setDf(s.toISOString().slice(0,10));setDt(now.toISOString().slice(0,10))}
    else if(p==='month'){setDf(new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10));setDt(now.toISOString().slice(0,10))}
    else if(p==='year'){setDf(new Date(now.getFullYear(),0,1).toISOString().slice(0,10));setDt(now.toISOString().slice(0,10))}
  }
  const inRange=useMemo(()=>visOps.filter(o=>o.createdAt.slice(0,10)>=df&&o.createdAt.slice(0,10)<=dt),[visOps,df,dt])
  const profit=inRange.reduce((s,o)=>s+(o.profit||0),0)
  const profitByClient=useMemo(()=>{const m={};inRange.filter(o=>o.clientId&&o.profit).forEach(o=>{if(!m[o.clientId])m[o.clientId]={name:o.clientName,profit:0,ops:0};m[o.clientId].profit+=o.profit;m[o.clientId].ops++});return Object.values(m).sort((a,b)=>b.profit-a.profit)},[inRange])
  const volumen=useMemo(()=>{const b={};inRange.forEach(o=>(o.legs||[]).filter(l=>l.kind==='account'&&l.delta<0).forEach(l=>{b[l.cur]=(b[l.cur]||0)+Math.abs(l.delta)}));return b},[inRange])
  const accSummary=useMemo(()=>accSummaryByType(accounts),[accounts])
  const allCredits=useMemo(()=>allCreditsByType(credits),[credits])
  const PRESETS=[{k:'today',l:'Hoy'},{k:'week',l:'7 días'},{k:'month',l:'Este mes'},{k:'year',l:'Este año'},{k:'custom',l:'Personalizado'}]
  return(
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22}}>Reportes</h2>
      <Card><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,marginBottom:12}}>Rango de fecha</div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{PRESETS.map(p=><Btn key={p.k} small onClick={()=>applyPreset(p.k)} style={{background:preset===p.k?'#0f0f0f':'#f0f0ea',color:preset===p.k?'#fff':'#555',border:'none'}}>{p.l}</Btn>)}</div><G2><Inp label="Desde" type="date" value={df} onChange={e=>{setDf(e.target.value);setPreset('custom')}}/><Inp label="Hasta" type="date" value={dt} onChange={e=>{setDt(e.target.value);setPreset('custom')}}/></G2><div style={{marginTop:10,fontSize:12,color:'#888'}}>{inRange.length} operaciones en el período seleccionado</div></Card>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(148px,1fr))',gap:12}}>
        <Card style={{background:profit>=0?'#dcfce7':'#fee2e2',border:'none'}}><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Profit del período</div><div style={{fontSize:24,fontWeight:800,fontFamily:"'Syne',sans-serif",color:profit>=0?'#16a34a':'#dc2626'}}>{profit>=0?'+':''}{fmt(profit,'USD')}</div></Card>
        <Card style={{background:'#f0f9ff',border:'none'}}><div style={{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6,fontFamily:"'Syne',sans-serif"}}>Operaciones</div><div style={{fontSize:24,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{inRange.length}</div></Card>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Card><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Volumen operado</div>{Object.keys(volumen).length===0?<div style={{fontSize:12,color:'#ccc'}}>Sin operaciones</div>:Object.entries(volumen).map(([cur,v])=><div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #f0f0ea'}}><Tag>{cur}</Tag><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:15}}>{fmt(v,cur)}</span></div>)}</Card>
        <Card><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Profit por cliente</div>{profitByClient.length===0?<div style={{fontSize:12,color:'#ccc'}}>Sin datos</div>:profitByClient.map(({name,profit:p,ops:n})=><div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid #f0f0ea'}}><div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:22,height:22,borderRadius:'50%',background:cliColor(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800}}>{name.slice(0,2)}</div><div><div style={{fontWeight:600,fontSize:13}}>{name}</div><div style={{fontSize:10,color:'#aaa'}}>{n} ops</div></div></div><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",color:p>=0?'#16a34a':'#dc2626'}}>{p>=0?'+':''}{fmt(p,'USD')}</span></div>)}</Card>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <Card><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Saldos actuales</div>{ACC_TYPES.map(type=>{const ent=Object.entries(accSummary[type]||{});return(<div key={type} style={{marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><div style={{width:8,height:8,borderRadius:'50%',background:ACC_COLOR[type]||'#ccc'}}/><span style={{fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em'}}>{type}</span></div>{ent.length===0?<div style={{fontSize:11,color:'#ccc',paddingLeft:10}}>$0</div>:ent.map(([cur,val])=><div key={cur} style={{display:'flex',justifyContent:'space-between',paddingLeft:10,borderLeft:`2px solid ${ACC_COLOR[type]||'#eee'}`,padding:'1px 0 1px 10px'}}><span style={{fontSize:12,color:'#888'}}>{cur}</span><span style={{fontSize:13,fontWeight:700,color:val<0?'#dc2626':'#0f0f0f'}}>{fmt(val,cur)}</span></div>)}</div>)})}</Card>
        <Card><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,marginBottom:14}}>Créditos abiertos</div>{Object.keys(allCredits).length===0?<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:24}}>✓</div><div style={{fontSize:12,color:'#888',marginTop:4}}>Sin créditos pendientes</div></div>:Object.entries(allCredits).map(([cur,v])=><div key={cur} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #f0f0ea'}}><Tag bg="#fef9c3" color="#b45309">{cur}</Tag><span style={{fontWeight:800,fontFamily:"'Syne',sans-serif",fontSize:15,color:'#b45309'}}>{fmt(v,cur)}</span></div>)}</Card>
      </div>
    </div>
  )
}

export default function TreasuryApp(){
  const{profile,signOut,isOperator}=useAuth()
  const{data:accounts,refetch:refetchAccounts}=useAccounts()
  const{data:clients, refetch:refetchClients} =useClients()
  const{data:ops,     refetch:refetchOps}     =useOperations()
  const{data:credits}                          =useCreditBalances()
  const[tab,setTab]=useState('Dashboard')
  const state={accounts,clients,ops,credits}
  const dispatch=async action=>{
    try{
      if(action.type==='ADD_OP')    {await addOperation(action.op);refetchOps();refetchAccounts()}
      if(action.type==='EDIT_OP')   {await editOperation(action.op,action.originalOp);refetchOps();refetchAccounts()}
      if(action.type==='ADD_CLI')   {await addClient(action.c);refetchClients()}
      if(action.type==='ADD_ACC')   {await addAccount(action.a);refetchAccounts()}
      if(action.type==='UPDATE_ACC'){await updateAccountOpeningBal(action.acc.id,action.acc.openingBal);refetchAccounts()}
    }catch(err){alert('Error: '+err.message)}
  }
  return(
    <div style={{display:'flex',minHeight:'100vh',fontFamily:"'DM Sans',sans-serif"}}>
      <Sidebar tab={tab} setTab={setTab} profile={profile} signOut={signOut}/>
      <main style={{flex:1,padding:'24px 28px',overflowY:'auto',overflowX:'hidden',maxWidth:'calc(100vw - 175px)'}}>
        {tab==='Dashboard'   &&<Dashboard   state={state} setTab={setTab}/>}
        {tab==='Operaciones' &&<Operaciones state={state} dispatch={isOperator?dispatch:null}/>}
        {tab==='Clientes'    &&<Clientes    state={state} dispatch={isOperator?dispatch:null}/>}
        {tab==='Cuentas'     &&<Cuentas     state={state} dispatch={isOperator?dispatch:null}/>}
        {tab==='Reportes'    &&<Reportes    state={state}/>}
      </main>
    </div>
  )
}
