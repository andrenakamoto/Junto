import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

// Signaler un message (chat d'un Plan ou d'un sondage) et, au choix, masquer son auteur.
// Serveur : routes/moderation.ts, lib/moderation.ts.
interface Props {
  kind: 'plan' | 'poll';
  messageId: string;
  author: { id: string; pseudo: string };
  onClose: () => void;
}

export function ReportMessageModal({ kind, messageId, author, onClose }: Props) {
  const { user, setUser } = useAuth();
  const [reason, setReason] = useState('');
  const [block, setBlock] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSending(true);
    setError('');
    try {
      await api.post('/moderation/reports', { kind, messageId, reason });
      if (block && user) {
        const { data } = await api.post('/moderation/blocks', { userId: author.id });
        setUser({ ...user, blockedUserIds: data.blockedUserIds });
      }
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur, réessaie dans un instant');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title="Signaler ce message" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Merci. Le message a été transmis à l'équipe EvLY, qui le supprimera s'il ne respecte pas les
            conditions d'utilisation.            {block && ' Ses messages ne te sont plus affichés.'}
          </p>
          <Button onClick={onClose} className="w-full">Fermer</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Message de <strong>@{author.pseudo}</strong> choquant, insultant ou indésirable ? L'équipe EvLY le
            lira et décidera de la suite. @{author.pseudo} ne saura pas que tu l'as signalé.
          </p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Pourquoi ? (facultatif)"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={block} onChange={e => setBlock(e.target.checked)} className="mt-0.5 accent-indigo-600" />
            <span>Masquer aussi les messages de @{author.pseudo}<span className="block text-xs text-slate-400">Tu peux l'annuler dans « Mon profil ».</span></span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={submit} disabled={sending} className="flex-1">{sending ? 'Envoi…' : 'Signaler'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
