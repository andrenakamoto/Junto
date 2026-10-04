import { useEffect, useState } from 'react';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { Plus, ArrowRight, Trash2, Check, Mail } from 'lucide-react';
import { Currency, ExpensesData, Plan, PlanMember } from '../../types';
import { BringItemsSection } from './BringItemsSection';
import { Button } from '../ui/Button';
import api from '../../services/api';

interface Props {
  planId: string;
  members: PlanMember[];
  userId: string;
  /** Pour « Qui apporte quoi ? », affiché en tête de l'onglet */
  plan: Plan;
  pseudo: string;
  onPlanUpdated: (plan: Plan) => void;
}

// Chaque dépense a sa devise ; les comptes sont tenus séparément par devise, sans conversion
const CURRENCIES: { value: Currency; label: string }[] = [{ value: 'CHF', label: 'CHF' }, { value: 'EUR', label: 'EUR (€)' }];

function money(n: number, currency: Currency) {
  return n.toLocaleString('fr-CH', { style: 'currency', currency });
}

export function DepensesTab({ planId, members, userId, plan, pseudo, onPlanUpdated }: Props) {
  const [data, setData] = useState<ExpensesData | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('CHF');
  const [splitWith, setSplitWith] = useState<string[]>(members.map(m => m.userId));
  const [creating, setCreating] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);

  async function refresh() {
    const { data } = await api.get(`/plans/${planId}/expenses`);
    setData(data);
  }

  useEffect(() => { refresh(); }, [planId]);
  // Dépense ou remboursement ajouté par un autre membre
  useSocketEvent<{ planId: string }>('plan-updated', p => { if (p.planId === planId) refresh().catch(() => {}); });

  function openForm() {
    setSplitWith(members.map(m => m.userId));
    setCurrency(data?.defaultCurrency ?? 'CHF');
    setShowAdd(true);
  }

  async function handleAddExpense() {
    if (!description.trim() || !amount || splitWith.length === 0) return;
    setCreating(true);
    try {
      await api.post(`/plans/${planId}/expenses`, { description: description.trim(), amount, currency, splitWith });
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

  async function handleSettle(toUserId: string, transferAmount: number, transferCurrency: Currency, key: string) {
    setSettling(key);
    try {
      await api.post(`/plans/${planId}/reimbursements`, { toUserId, amount: transferAmount, currency: transferCurrency });
      await refresh();
    } finally {
      setSettling(null);
    }
  }

  if (!data) {
    return <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 text-sm text-slate-400">Chargement...</div>;
  }

  const nonZero = (amounts: { currency: Currency; balance: number }[]) => amounts.filter(a => Math.abs(a.balance) > 0.01);
  const mine = nonZero(data.balances.find(b => b.userId === userId)?.amounts ?? []);
  const multiCurrency = data.balances[0]?.amounts.length > 1;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-5 short:flex-none short:overflow-visible">
      <BringItemsSection plan={plan} pseudo={pseudo} onChanged={async () => onPlanUpdated((await api.get(`/plans/${planId}`)).data)} />

      <h3 className="font-semibold text-slate-800 text-sm -mb-2">Dépenses</h3>
      {/* Ajout, toujours en haut des dépenses */}
      {!showAdd ? (
        <button
          onClick={openForm}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />Ajouter une dépense
        </button>
      ) : (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Nouvelle dépense</p>
          <input
            autoFocus
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex : Courses, essence, resto..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Montant"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 flex-shrink-0" role="group" aria-label="Devise">
              {CURRENCIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCurrency(c.value)}
                  aria-pressed={currency === c.value}
                  className={`px-3 rounded-md text-xs font-semibold transition-colors ${
                    currency === c.value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
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

      <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
        <Mail size={13} className="flex-shrink-0 mt-0.5" />
        <span>Un résumé des dépenses sera envoyé par email à tous les membres à la fin du Plan.</span>
      </div>

      {/* Soldes, une colonne par devise utilisée */}
      {data.balances[0]?.amounts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Soldes</h3>
          <div className="space-y-1.5">
            {data.balances.map(b => (
              <div key={b.userId} className="flex items-center justify-between gap-3 text-sm">
                <span className={b.userId === userId ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                  @{b.pseudo}{b.userId === userId && ' (toi)'}
                </span>
                <span className="flex flex-wrap justify-end gap-x-3 font-medium tabular-nums">
                  {nonZero(b.amounts).length === 0
                    ? <span className="text-slate-400">—</span>
                    : nonZero(b.amounts).map(a => (
                      <span key={a.currency} className={a.balance > 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {a.balance > 0 ? '+' : ''}{money(a.balance, a.currency)}
                      </span>
                    ))}
                </span>
              </div>
            ))}
          </div>
          {mine.length > 0 && (
            <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
              {mine.every(a => a.balance > 0) ? 'On te doit de l\'argent au total.'
                : mine.every(a => a.balance < 0) ? 'Tu dois de l\'argent au total.'
                : 'On te doit de l\'argent dans une devise, tu en dois dans l\'autre.'}
            </p>
          )}
          {multiCurrency && (
            <p className="text-xs text-slate-400 mt-1">Les CHF et les euros sont comptés séparément, sans conversion.</p>
          )}
        </div>
      )}

      {/* Virements suggérés */}
      {data.suggestedTransfers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Qui doit quoi à qui</h3>
          <div className="space-y-2">
            {data.suggestedTransfers.map(t => {
              const key = `${t.fromUserId}-${t.toUserId}-${t.currency}`;
              const involvesMe = t.fromUserId === userId || t.toUserId === userId;
              return (
                <div key={key} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${involvesMe ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-700 min-w-0">
                    <span className="break-all">@{t.fromPseudo}</span>
                    <ArrowRight size={12} className="text-slate-400 flex-shrink-0" />
                    <span className="break-all">@{t.toPseudo}</span>
                    <span className="font-semibold text-slate-800 flex-shrink-0">{money(t.amount, t.currency)}</span>
                  </div>
                  {t.fromUserId === userId && (
                    <button
                      onClick={() => handleSettle(t.toUserId, t.amount, t.currency, key)}
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
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Dépenses ({data.expenses.length})</h3>
        {data.expenses.length === 0 ? (
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
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{money(exp.amount, exp.currency)}</span>
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
