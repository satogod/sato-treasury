/**
 * TreasuryApp.jsx
 *
 * Este archivo reemplaza el widget del artifact.
 * Usa useAccounts, useClients, useOperations, useCreditBalances
 * de src/hooks/useData.js en lugar de localStorage.
 *
 * El código de UI (Dashboard, Operaciones, Clientes, Cuentas, Reportes,
 * Sidebar, modales, etc.) es exactamente el mismo del artifact v6,
 * con estos cambios puntuales:
 *
 *  ANTES (localStorage):
 *    const [state, dispatch] = useReducer(reducer, null, loadS)
 *
 *  DESPUÉS (Supabase):
 *    const { data: accounts, refetch: refetchAccounts } = useAccounts()
 *    const { data: clients,  refetch: refetchClients  } = useClients()
 *    const { data: ops,      refetch: refetchOps      } = useOperations()
 *    const { data: credits                            } = useCreditBalances()
 *
 *  Y cada dispatch se reemplaza por:
 *    await addOperation(op);   refetchOps(); refetchAccounts()
 *    await addClient(client);  refetchClients()
 *    await addAccount(acc);    refetchAccounts()
 *
 *  El rol del usuario viene de useAuth():
 *    const { isOperator, isAdmin, signOut, profile } = useAuth()
 *  Mostrá el botón "+ Nueva operación" solo si isOperator.
 *
 * Pegá aquí el JSX del artifact v6 con los cambios de arriba.
 */

import { useAuth } from '../hooks/useAuth'
import {
  useAccounts, useClients, useOperations, useCreditBalances,
  addOperation, editOperation, addClient, addAccount, updateAccountOpeningBal,
} from '../hooks/useData'

export default function TreasuryApp() {
  const { profile, signOut, isOperator, isAdmin } = useAuth()
  const { data: accounts, refetch: refetchAccounts } = useAccounts()
  const { data: clients,  refetch: refetchClients  } = useClients()
  const { data: ops,      refetch: refetchOps      } = useOperations()
  const { data: credits                             } = useCreditBalances()

  // Adaptor so existing UI code still works with a single `state` object
  const state = { accounts, clients, ops, credits }

  const dispatch = async (action) => {
    try {
      if (action.type === 'ADD_OP')    { await addOperation(action.op);                       refetchOps(); refetchAccounts() }
      if (action.type === 'EDIT_OP')   { await editOperation(action.op, action.originalOp);   refetchOps(); refetchAccounts() }
      if (action.type === 'ADD_CLI')   { await addClient(action.c);                           refetchClients() }
      if (action.type === 'ADD_ACC')   { await addAccount(action.a);                          refetchAccounts() }
      if (action.type === 'UPDATE_ACC'){ await updateAccountOpeningBal(action.acc.id, action.acc.openingBal); refetchAccounts() }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div>
      {/* Pegá aquí el JSX completo del artifact v6 */}
      {/* Agregá en el Sidebar el nombre del usuario y botón de logout: */}
      {/*   <div>{profile?.name}</div>                                   */}
      {/*   <button onClick={signOut}>Salir</button>                     */}
      <p style={{padding:40, fontFamily:'sans-serif', color:'#888'}}>
        ⬆ Pegá el JSX del artifact v6 en este archivo.<br/>
        Reemplazá useReducer por los hooks de arriba (ver comentarios).
      </p>
    </div>
  )
}
