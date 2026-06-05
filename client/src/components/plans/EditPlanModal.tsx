import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan } from '../../types';

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

interface Props {
  plan: Plan;
  onClose: () => void;
  onUpdated: (plan: Plan) => void;
}

export function EditPlanModal({ plan, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [eventDate, setEventDate] = useState(isoToLocal(plan.eventDate));
  const [endDate, setEndDate] = useState(isoToLocal(plan.endDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.put(`/plans/${plan.id}`, {
        title,
        description,
        eventDate: eventDate ? localToISO(eventDate) : null,
        endDate: localToISO(endDate),
      });
      onUpdated(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Modifier le Plan" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 resize-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Les membres qui ont déjà rejoint le plan voient cette mise à jour.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date et heure de l'événement (optionnel)</label>
          <input
            type="datetime-local"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin du Plan</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Le Plan sera automatiquement supprimé après cette date.</p>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
