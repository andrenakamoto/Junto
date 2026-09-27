import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { disconnectSocket } from '../../lib/socket';
import api from '../../services/api';

interface Props {
  onClose: () => void;
}

export function DeleteAccountModal({ onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Compte Google sans mot de passe : on confirme en tapant SUPPRIMER
  const needsPassword = user?.hasPassword !== false;
  const ready = needsPassword ? password.length > 0 : confirmation === 'SUPPRIMER';

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setError('');
    try {
      await api.post('/auth/delete-account', needsPassword ? { password } : { confirmation });
      disconnectSocket();
      logout();
      navigate('/auth', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression');
      setDeleting(false);
    }
  }

  return (
    <Modal title="Supprimer mon compte" onClose={onClose}>
      <form onSubmit={handleDelete} className="space-y-4">
        <div className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-semibold">Cette action est définitive.</p>
            <ul className="list-disc pl-4 space-y-1 text-red-700">
              <li>Tes messages, réactions, votes, trajets et dépenses sont effacés.</li>
              <li>Les Cercles et Plans que tu as créés sont confiés au membre le plus ancien (supprimés si tu y étais seul).</li>
              <li>Les photos que tu as partagées restent dans les Plans.</li>
            </ul>
          </div>
        </div>

        {needsPassword ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="delete-password" className="text-sm font-medium text-slate-700">Ton mot de passe, pour confirmer</label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-900"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="delete-confirmation" className="text-sm font-medium text-slate-700">
              Tape <span className="font-mono font-bold">SUPPRIMER</span> pour confirmer
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              autoFocus
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-900 font-mono"
            />
          </div>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="danger" disabled={!ready || deleting} className="flex items-center gap-1.5">
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Supprimer définitivement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
