import { useState } from 'react';
import { Mail } from 'lucide-react';
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
        <EmailSection />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving || !firstName.trim()}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Adresse email : affichage, et changement confirmé par un lien envoyé à la nouvelle adresse
function EmailSection() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user) return null;

  async function run(action: () => Promise<{ data: any }>, success: string) {
    setBusy(true); setMsg(null);
    try {
      const { data } = await action();
      if (data?.id) setUser(data);
      setMsg({ ok: true, text: success });
      setEditing(false); setNewEmail(''); setPassword('');
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Erreur' });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && !!newEmail.trim() && (!user.hasPassword || !!password);
  // Dans le formulaire du profil : Entrée envoie le lien au lieu d'enregistrer le prénom
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (canSubmit) submit(); } };
  const submit = () => run(
    () => api.post('/auth/change-email', { email: newEmail, password: user.hasPassword ? password : undefined }),
    `Un lien de confirmation a été envoyé à ${newEmail.trim().toLowerCase()}. Ton adresse actuelle reste active jusqu'au clic.`,
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">Email</span>
      {user.email ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm truncate">{user.email}</div>
          {!editing && (
            <button type="button" onClick={() => { setEditing(true); setMsg(null); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex-shrink-0">
              Changer
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">Aucun email associé à ce compte.</p>
      )}
      {user.email && !user.emailVerified && !user.pendingEmail && (
        <p className="text-xs text-amber-600">Email pas encore vérifié : pense à cliquer sur le lien reçu.</p>
      )}

      {user.pendingEmail && !editing && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 space-y-1">
          <p><Mail size={12} className="inline -mt-0.5 mr-1.5" />Changement en attente vers <strong className="break-all">{user.pendingEmail}</strong> : clique sur le lien reçu à cette adresse.</p>
          <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => run(() => api.post('/auth/change-email/resend'), `Nouveau lien envoyé à ${user.pendingEmail}.`)} className="font-semibold underline underline-offset-2 disabled:opacity-50">Renvoyer le lien</button>
            <button type="button" disabled={busy} onClick={() => run(() => api.delete('/auth/change-email'), 'Changement annulé.')} className="font-semibold underline underline-offset-2 disabled:opacity-50">Annuler</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Nouvelle adresse email"
            autoComplete="email"
            autoFocus
            onKeyDown={onEnter}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {user.hasPassword && (
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Ton mot de passe actuel"
              autoComplete="current-password"
              onKeyDown={onEnter}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <p className="text-xs text-slate-500">Un lien de confirmation sera envoyé à la nouvelle adresse ; l'ancienne reste active d'ici là.</p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setMsg(null); }}>Annuler</Button>
            <Button type="button" size="sm" onClick={submit} disabled={!canSubmit}>
              {busy ? 'Envoi…' : 'Envoyer le lien'}
            </Button>
          </div>
        </div>
      )}

      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}
    </div>
  );
}
