import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Plan } from '../../types';

function localDateTimeToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

interface Props {
  circleId: string;
  onClose: () => void;
  onCreated: (plan: Plan) => void;
}

export function CreatePlanModal({ circleId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/circles/${circleId}/plans`, {
        title,
        description,
        eventDate: eventDate ? localDateTimeToISO(eventDate) : null,
        endDate: localDateTimeToISO(endDate),
        location: location || null,
      });
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Créer un Plan" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">Rejoindre un Plan = être d'accord avec sa description.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Titre" value={title} onChange={e => setTitle(e.target.value)} placeholder="Qui veut manger ce midi ?" required autoFocus />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Décris l'événement. Les gens qui rejoignent ce Plan sont d'accord avec ce que tu écris ici."
            required
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
          />
        </div>
        <Input label="Date et heure de l'événement (optionnel)" type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        <Input label="Date de fin du Plan" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} required />
        <p className="text-xs text-slate-400 -mt-2">Le Plan sera automatiquement supprimé après cette date.</p>
        <Input label="Lieu (optionnel)" value={location} onChange={e => setLocation(e.target.value)} placeholder="Place de la République, Chez Marco..." />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer le Plan'}</Button>
        </div>
      </form>
    </Modal>
  );
}
