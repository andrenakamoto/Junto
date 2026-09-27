import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface Props {
  onClose: () => void;
}

export function ProfileModal({ onClose }: Props) {
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put('/auth/profile', { firstName, lastName });
      setUser(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Mon profil" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Ton prénom aide les membres de tes Cercles à te reconnaître derrière ton pseudo @{user?.pseudo}.
        </p>
        <Input id="profile-firstName" label="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={50} autoComplete="given-name" autoFocus />
        <Input id="profile-lastName" label="Nom (facultatif)" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={50} autoComplete="family-name" />
        <div className="flex flex-col gap-1">
          <label htmlFor="profile-email" className="text-sm font-medium text-slate-700">Email</label>
          {user?.email ? (
            <>
              <input
                id="profile-email"
                type="email"
                value={user.email}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm cursor-default focus:outline-none"
              />
              {!user.emailVerified && (
                <p className="text-xs text-amber-600">Email pas encore vérifié : pense à cliquer sur le lien reçu.</p>
              )}
            </>
          ) : (
            <p id="profile-email" className="text-sm text-slate-400 italic">Aucun email associé à ce compte.</p>
          )}
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving || !firstName.trim()}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}
