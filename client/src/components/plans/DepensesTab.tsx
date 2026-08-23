import { useEffect, useState } from 'react';
import { Plus, ArrowRight, Trash2, Check, Mail } from 'lucide-react';
import { ExpensesData, PlanMember } from '../../types';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface Props {
  planId: string;
  members: PlanMember[];
  userId: string;
}

function formatEuros(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function DepensesTab({ planId, members, userId }: Props) {
  const [data, setData] = useState<ExpensesData | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitWith, setSplitWith] = useState<string[]>(members.map(m => m.userId));
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  async function refresh() {
    const { data } = await api.get(`/plans/${planId}/expenses`);
    setData(data);
  }

  useEffect(() => { refresh(); }, [planId]);

  async function handleAddExpense() {
    if (!description.trim() || !amount || splitWith.length === 0) return;
    setCreating(true);
    try {
      await api.post(`/plans/${planId}/expenses`, { description: description.trim(), amount, splitWith });
      setDescription('');
      setAmount('');
      setShowAdd(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  function toggleSplitMember(userId: string) {
    setSplitWith(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  }

  async function handleDeleteExpense(id: string) {
    await api.delete(`/plans/expenses/${id}`);
    await refresh();
  }

  async function handleSettle(fromUserId: string, toUserId: string, transferAmount: number) {
    const key = `${fromUserId}-${toUserId}`;
    setSettling(key);
    try {
      await api.post(`/plans/${planId}/reimbursements`, { toUserId, amount: transferAmount });
      await refresh();
    } finally {
      setSettling(null);
    }
  }

  if (!data) {
    return <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 text-sm text-slate-400">Chargement...</div>;
  }

  const myBalance = data.balances.find(b => b.userId === userId);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-5">
      <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
        <Mail size={13} className="flex-shrink-0 mt-0.5" />
        <span>Un résumé des dépenses sera envoyé par email à tous les membres à la fin du Plan.</span>
      </div>

      {/* Résumé des soldes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Soldes</h3>
        <div className="space-y-1.5">
          {data.balances.map(b => (
            <div key={b.userId} className="flex items-center justify-between text-sm">
              <span className={b.userId === userId ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                @{b.pseudo}{b.userId === userId && ' (toi)'}
              </span>
              <span className={`font-medium ${b.balance > 0.01 ? 'text-emerald-600' : b.balance < -0.01 ? 'text-red-500' : 'text-slate-400'}`}>
                {b.balance > 0.01 ? `+${formatEuros(b.balance)}` : b.balance < -0.01 ? formatEuros(b.balance) : '—'}
              </span>
            </div>
          ))}
        </div>
        {myBalance && Math.abs(myBalance.balance) > 0.01 && (
          <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            {myBalance.balance > 0 ? 'On te doit de l\'argent au total.' : 'Tu dois de l\'argent au total.'}
          </p>
        )}
      </div>

      {/* Virements suggérés */}
      {data.suggestedTransfers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Qui doit quoi à qui</h3>
          <div className="space-y-2">
            {data.suggestedTransfers.map((t, i) => {
              const key = `${t.fromUserId}-${t.toUserId}`;
              const involvesMe = t.fromUserId === userId || t.toUserId === userId;
              return (
                <div key={i} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${involvesMe ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 text-sm text-slate-700 min-w-0">
                    <span className="truncate">@{t.fromPseudo}</span>
                    <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">@{t.toPseudo}</span>
                    <span className="font-semibold text-slate-800 flex-shrink-0">{formatEuros(t.amount)}</span>
                  </div>
                  {t.fromUserId === userId && (
                    <button
                      onClick={() => handleSettle(t.fromUserId, t.toUserId, t.amount)}
                      disabled={settling === key}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      <Check size={11} />
                      {settling === key ? '...' : 'Remboursé'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des dépenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 text-sm">Dépenses ({data.expenses.length})</h3>
          {!showAdd && (
            <button
              onClick={() => { setSplitWith(members.map(m => m.userId)); setShowAdd(true); }}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={14} />Ajouter
            </button>
          )}
        </div>

        {showAdd && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 mb-3">
            <input
              autoFocus
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex : Courses, essence, resto..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Montant en €"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Partagée entre :</p>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleSplitMember(m.userId)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      splitWith.includes(m.userId)
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    @{m.user.pseudo}
                  </button>
                ))}
              </div>
              {splitWith.length > 0 && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Réparti à parts égales entre {splitWith.length} membre{splitWith.length > 1 ? 's' : ''}.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddExpense} disabled={creating || splitWith.length === 0} size="sm">{creating ? 'Ajout...' : 'Ajouter'}</Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)} size="sm">Annuler</Button>
            </div>
          </div>
        )}

        {data.expenses.length === 0 && !showAdd ? (
          <p className="text-sm text-slate-400 italic">Aucune dépense enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {data.expenses.map(exp => (
              <div key={exp.id} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{exp.description}</p>
                  <p className="text-xs text-slate-400">
                    payé par @{exp.paidBy.pseudo}
                    {exp.splitWith.length > 0 && exp.splitWith.length !== members.length && (
                      <> · partagé avec {exp.splitWith.map(s => `@${s.user.pseudo}`).join(', ')}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-800">{formatEuros(exp.amount)}</span>
                  {(exp.paidById === userId) && (
                    <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
