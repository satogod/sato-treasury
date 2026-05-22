import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function useTable(table, query = (q) => q) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error: err } = await query(supabase.from(table).select('*'))
    if (err) setError(err.message)
    else setData(rows || [])
    setLoading(false)
  }, [table])
  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

// ── Accounts ──────────────────────────────────────────────────────────────────
export function useAccounts() {
  return useTable('account_balances')
}
export async function addAccount(acc) {
  const { error } = await supabase.from('accounts').insert({
    name: acc.name, type: acc.type, currency: acc.currency,
    titular: acc.titular, opening_bal: acc.openingBal || 0,
  })
  if (error) throw error
}
export async function updateAccount(id, fields) {
  const { error } = await supabase.from('accounts').update(fields).eq('id', id)
  if (error) throw error
}
export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}
export async function updateAccountOpeningBal(id, opening_bal) {
  const { error } = await supabase.from('accounts').update({ opening_bal }).eq('id', id)
  if (error) throw error
}

// ── Clients ───────────────────────────────────────────────────────────────────
export function useClients() {
  return useTable('clients', q => q.order('name'))
}
export async function addClient(client) {
  const { error } = await supabase.from('clients')
    .insert({ name: client.name, phone: client.phone, notes: client.notes })
  if (error) throw error
}
export async function updateClient(id, fields) {
  const { error } = await supabase.from('clients').update(fields).eq('id', id)
  if (error) throw error
}
export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

// ── Operations ────────────────────────────────────────────────────────────────
export function useOperations() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: ops, error: err } = await supabase
      .from('operations')
      .select(`*, legs:operation_legs(*)`)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setData((ops || []).map(normalizeOp))
    setLoading(false)
  }, [])
  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

function normalizeOp(op) {
  return {
    id: op.id,
    createdAt: op.created_at,
    detail: op.detail,
    mode: op.mode,
    clientId: op.client_id,
    clientName: op.client_name,
    rate: op.rate,
    profit: op.profit,
    isReversal: op.is_reversal,
    attachments: op.attachments || [],
    legs: (op.legs || []).map(l => ({
      id: l.id, kind: l.kind,
      accId: l.account_id, clientId: l.client_id,
      clientName: l.client_name, cur: l.currency,
      delta: Number(l.delta),
    })),
  }
}

export async function addOperation(op) {
  const { data: inserted, error: opErr } = await supabase
    .from('operations')
    .insert({
      created_at: op.createdAt, detail: op.detail, mode: op.mode,
      client_id: op.clientId || null, client_name: op.clientName || null,
      rate: op.rate || null, profit: op.profit || null,
      is_reversal: op.isReversal || false,
      attachments: op.attachments || [],
    })
    .select('id').single()
  if (opErr) throw opErr
  if (op.legs && op.legs.length > 0) {
    const legs = op.legs.map(l => ({
      operation_id: inserted.id, kind: l.kind,
      account_id: l.kind === 'account' ? l.accId : null,
      client_id: l.kind === 'credit' ? l.clientId : null,
      client_name: l.kind === 'credit' ? l.clientName : null,
      currency: l.cur, delta: l.delta,
    }))
    const { error: legErr } = await supabase.from('operation_legs').insert(legs)
    if (legErr) throw legErr
  }
  return inserted.id
}

// Edit = update in place: delete old legs, insert new ones, update op fields
export async function editOperation(op, originalOp) {
  // 1. Delete existing legs for this operation
  const { error: delErr } = await supabase
    .from('operation_legs').delete().eq('operation_id', originalOp.id)
  if (delErr) throw delErr

  // 2. Update the operation record itself
  const { error: upErr } = await supabase
    .from('operations')
    .update({
      created_at: op.createdAt,
      detail: op.detail,
      mode: op.mode,
      client_id: op.clientId || null,
      client_name: op.clientName || null,
      rate: op.rate || null,
      profit: op.profit || null,
      attachments: op.attachments || [],
    })
    .eq('id', originalOp.id)
  if (upErr) throw upErr

  // 3. Insert new legs
  if (op.legs && op.legs.length > 0) {
    const legs = op.legs.map(l => ({
      operation_id: originalOp.id, kind: l.kind,
      account_id: l.kind === 'account' ? l.accId : null,
      client_id: l.kind === 'credit' ? l.clientId : null,
      client_name: l.kind === 'credit' ? l.clientName : null,
      currency: l.cur, delta: l.delta,
    }))
    const { error: legErr } = await supabase.from('operation_legs').insert(legs)
    if (legErr) throw legErr
  }
}

export async function deleteOperation(opId) {
  // legs cascade on delete via FK
  const { error } = await supabase.from('operations').delete().eq('id', opId)
  if (error) throw error
}

// ── Upload attachment ─────────────────────────────────────────────────────────
export async function uploadAttachment(file, opId) {
  const ext  = file.name.split('.').pop()
  const path = `${opId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('comprobantes').upload(path, file)
  if (error) throw error
  return path
}

export async function getAttachmentUrl(path) {
  const { data } = await supabase.storage.from('comprobantes').createSignedUrl(path, 3600)
  return data?.signedUrl
}

// ── Credit balances view ──────────────────────────────────────────────────────
export function useCreditBalances() {
  return useTable('client_credit_balances')
}
