import { useState } from 'react';
import { MapPin, Plus, Check } from 'lucide-react';
import { Plan, BringItem } from '../../types';
import api from '../../services/api';

interface Props {
  plan: Plan;
  onPlanUpdated: (plan: Plan) => void;
  pseudo: string;
}

export function InfosTab({ plan, onPlanUpdated, pseudo }: Props) {
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  async function refresh() {
    const { data } = await api.get(`/plans/${plan.id}`);
    onPlanUpdated(data);
  }

  async function handleAddItem() {
    if (!newItem.trim()) return;
    await api.post(`/plans/${plan.id}/items`, { label: newItem.trim() });
    setNewItem('');
    setAddingItem(false);
    await refresh();
  }

  async function handleClaim(itemId: string) {
    await api.put(`/plans/items/${itemId}/claim`);
    await refresh();
  }

  const items = plan.items || [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 space-y-6">
      {plan.location && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-1">
            <MapPin size={15} className="text-indigo-500" />
            Lieu du rendez-vous
          </div>
          <p className="text-slate-600 text-sm pl-5">{plan.location}</p>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Qui apporte quoi ?</h3>
        <div className="space-y-2">
          {items.length === 0 && !addingItem && (
            <p className="text-sm text-slate-400 italic">Rien de prévu pour l'instant.</p>
          )}
          {items.map(item => (
            <BringItemRow key={item.id} item={item} myPseudo={pseudo} onClaim={() => handleClaim(item.id)} />
          ))}
        </div>

        {addingItem ? (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              placeholder="Ex: bouteille de vin"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <button onClick={handleAddItem} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">OK</button>
            <button onClick={() => { setAddingItem(false); setNewItem(''); }} className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">Annuler</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-1.5 mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus size={14} />
            Ajouter un élément
          </button>
        )}
      </div>
    </div>
  );
}

function BringItemRow({ item, myPseudo, onClaim }: { item: BringItem; myPseudo: string; onClaim: () => void }) {
  const isMe = item.claimedBy === myPseudo;
  const taken = !!item.claimedBy;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${taken ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${taken ? 'bg-emerald-500' : 'border-2 border-slate-300'}`}>
        {taken && <Check size={11} className="text-white" />}
      </div>
      <span className={`flex-1 text-sm ${taken ? 'text-slate-600' : 'text-slate-800'}`}>{item.label}</span>
      {taken && <span className="text-xs text-slate-500">@{item.claimedBy}</span>}
      <button
        onClick={onClaim}
        disabled={taken && !isMe}
        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
          isMe ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
          taken ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
          'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
        }`}
      >
        {isMe ? 'Je prends ça ✓' : taken ? 'Pris' : 'Je prends ça'}
      </button>
    </div>
  );
}
