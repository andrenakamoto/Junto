import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { Circle } from '../../types';

interface Props {
  onClose: () => void;
  onJoined: (circle: Circle) => void;
}

export function JoinCircleModal({ onClose, onJoined }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles/join', { name, code: code.toUpperCase() });
      onJoined(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Rejoindre un Cercle" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">Demande le nom et le code à quelqu'un qui en fait partie.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom du Cercle" value={name} onChange={e => setName(e.target.value)} placeholder="Les amis du lundi" required autoFocus />
        <Input
          label="Code d'accès"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="AB3X7Y"
          maxLength={6}
          required
          className="tracking-widest font-mono uppercase"
        />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Recherche...' : 'Rejoindre'}</Button>
        </div>
      </form>
    </Modal>
  );
}
