import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Circle } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: (circle: Circle) => void;
}

export function CreateCircleModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles', { name, description });
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
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Création...' : 'Créer le Cercle'}</Button>
        </div>
      </form>
    </Modal>
  );
}
