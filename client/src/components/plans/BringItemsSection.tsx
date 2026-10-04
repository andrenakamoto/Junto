import { useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { BringItem, Plan } from '../../types';
import api from '../../services/api';

// « Qui apporte quoi ? » : fait partie de l'onglet Dépenses (désactivé avec lui). Quantité
// facultative en texte libre ; modifier ou retirer un élément : son auteur ou le créateur du Plan.
export function BringItemsSection({ plan, pseudo, userId, onChanged }: { plan: Plan; pseudo: string; userId: string; onChanged: () => Promise<void> | void }) {
  const [addingItem, setAddingItem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const items = plan.items || [];

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await onChanged();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur, réessaie dans un instant');
      return false;
    }
  }

  async function handleAdd(label: string, quantity: string) {
    if (await run(() => api.post(`/plans/${plan.id}/items`, { label, quantity }))) setAddingItem(false);
  }

  async function handleEdit(item: BringItem, label: string, quantity: string) {
    if (await run(() => api.put(`/plans/items/${item.id}`, { label, quantity }))) setEditingId(null);
  }

  async function handleRemove(item: BringItem) {
    if (item.claimedBy && !confirm(`Retirer « ${item.label} » ? @${item.claimedBy} l’avait pris.`)) return;
    await run(() => api.delete(`/plans/items/${item.id}`));
  }

  return (
    <div>
      <h3 className="font-semibold text-slate-800 text-sm mb-3">Qui apporte quoi ?</h3>
      <div className="space-y-2">
        {items.length === 0 && !addingItem && (
          <p className="text-sm text-slate-400 italic">Rien de prévu pour l'instant.</p>
        )}
        {items.map(item => editingId === item.id ? (
          <ItemForm
            key={item.id}
            initialLabel={item.label}
            initialQuantity={item.quantity ?? ''}
            submitLabel="Enregistrer"
            onSubmit={(label, quantity) => handleEdit(item, label, quantity)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <BringItemRow
            key={item.id}
            item={item}
            myPseudo={pseudo}
            onClaim={() => run(() => api.put(`/plans/items/${item.id}/claim`))}
            canManage={item.createdById === userId || plan.creatorId === userId}
            onEdit={() => { setAddingItem(false); setEditingId(item.id); }}
            onRemove={() => handleRemove(item)}
          />
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {addingItem ? (
        <div className="mt-3">
          <ItemForm submitLabel="Ajouter" onSubmit={handleAdd} onCancel={() => setAddingItem(false)} />
        </div>
      ) : (
        <button
          onClick={() => { setEditingId(null); setAddingItem(true); }}
          className="flex items-center gap-1.5 mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          <Plus size={14} />
          Ajouter un élément
        </button>
      )}
    </div>
  );
}

// Ajout ou modification : élément + quantité facultative
function ItemForm({ initialLabel = '', initialQuantity = '', submitLabel, onSubmit, onCancel }: {
  initialLabel?: string; initialQuantity?: string; submitLabel: string;
  onSubmit: (label: string, quantity: string) => void; onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [quantity, setQuantity] = useState(initialQuantity);
  const submit = () => { if (label.trim()) onSubmit(label.trim(), quantity.trim()); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); };
  const input = 'px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-0';
  return (
    <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
      <div className="flex gap-2">
        <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onKeyDown={onKey} maxLength={100} placeholder="Ex : fromage à raclette" className={`flex-1 ${input}`} />
        <input value={quantity} onChange={e => setQuantity(e.target.value)} onKeyDown={onKey} maxLength={30} placeholder="Quantité (facultatif)" className={`w-36 ${input}`} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">Annuler</button>
        <button onClick={submit} disabled={!label.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}

function BringItemRow({ item, myPseudo, onClaim, canManage, onEdit, onRemove }: {
  item: BringItem; myPseudo: string; onClaim: () => void; canManage: boolean; onEdit: () => void; onRemove: () => void;
}) {
  const isMe = item.claimedBy === myPseudo;
  const taken = !!item.claimedBy;
  const details = [item.quantity, taken ? `@${item.claimedBy}` : null].filter(Boolean).join(' · ');

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${taken ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${taken ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
        {taken && <Check size={11} className="text-white" />}
      </div>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm break-words ${taken ? 'text-slate-600' : 'text-slate-800'}`}>{item.label}</span>
        {details && <span className="block text-xs text-slate-500 truncate">{details}</span>}
      </span>
      <button
        onClick={onClaim}
        disabled={taken && !isMe}
        className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
          isMe ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
          taken ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
          'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
        }`}
      >
        {isMe ? 'Je prends ça ✓' : taken ? 'Pris' : 'Je prends ça'}
      </button>
      {canManage && (
        <span className="flex-shrink-0 flex -mr-1">
          <button onClick={onEdit} title="Modifier cet élément" aria-label={`Modifier « ${item.label} »`} className="p-1 rounded-md text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onRemove} title="Retirer cet élément" aria-label={`Retirer « ${item.label} »`} className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}
