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
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ circleName: string; byCreator: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/circles/join', { code: code.toUpperCase() });
      if (data.pending) {
        setPending({ circleName: data.circleName, byCreator: data.admissionMode === 'creator' });
      } else {
        onJoined(data.circle);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <Modal title="Demande envoyée" onClose={onClose}>
        <p className="text-sm text-slate-600 mb-4">
          Ta demande pour rejoindre <strong>"{pending.circleName}"</strong> a été envoyée.
          {pending.byCreator
            ? " Le créateur ou un organisateur du Cercle doit l'approuver avant que tu puisses y accéder."
            : " Les membres du Cercle doivent l'approuver (majorité requise) avant que tu puisses y accéder."}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>OK</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Rejoindre un Cercle" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">Demande le code d'accès à quelqu'un qui en fait partie. Selon le Cercle, ta demande devra peut-être être validée.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Code d'accès"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="AB3X7Y"
          maxLength={6}
          required
          autoFocus
          className="tracking-widest font-mono uppercase"
        />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Envoi...' : 'Demander à rejoindre'}</Button>
        </div>
      </form>
    </Modal>
  );
}
