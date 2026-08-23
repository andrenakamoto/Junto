import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Circle } from '../../types';

export const CIRCLE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];

interface Props {
  onClose: () => void;
  onCreated: (circle: Circle) => void;
}

export function CreateCircleModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles', { name, description, color });
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Créer un Cercle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom du Cercle" value={name} onChange={e => setName(e.target.value)} placeholder="Les amis du lundi" required autoFocus />
        <Input label="Description (optionnel)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Notre petit groupe de copains..." />
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Couleur (optionnel)</label>
          <div className="flex gap-2">
            {CIRCLE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(color === c ? null : c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer le Cercle'}</Button>
        </div>
      </form>
    </Modal>
  );
}
