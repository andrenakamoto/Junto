import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { t } from '../../i18n';
import { Trans } from 'react-i18next';
import { LanguagePicker } from './LanguagePicker';

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
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t('account.profile.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          {t('account.profile.intro', { pseudo: user?.pseudo })}
        </p>
        <Input id="profile-firstName" label={t('account.profile.firstName')} value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={50} autoComplete="given-name" autoFocus />
        <Input id="profile-lastName" label={t('account.profile.lastName')} value={lastName} onChange={e => setLastName(e.target.value)} maxLength={50} autoComplete="family-name" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">{t('common.language')}</span>
          <div className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900"><LanguagePicker loggedIn /></div>
          <span className="text-xs text-slate-400">{t('account.profile.languageHint')}</span>
        </div>
        <EmailSection />
        <BlockedSection />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={saving || !firstName.trim()}>{saving ? t('common.saving') : t('common.save')}</Button>
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
    t('account.profile.linkSent', { email: newEmail.trim().toLowerCase() }),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{t('account.profile.email')}</span>
      {user.email ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm truncate">{user.email}</div>
          {!editing && (
            <button type="button" onClick={() => { setEditing(true); setMsg(null); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex-shrink-0">
              {t('account.profile.change')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">{t('account.profile.noEmail')}</p>
      )}
      {user.email && !user.emailVerified && !user.pendingEmail && (
        <p className="text-xs text-amber-600">{t('account.profile.notVerified')}</p>
      )}

      {user.pendingEmail && !editing && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 space-y-1">
          <p><Mail size={12} className="inline -mt-0.5 mr-1.5" /><Trans i18nKey="account.profile.pending" values={{ email: user.pendingEmail }} components={{ b: <strong className="break-all" /> }} /></p>
          <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => run(() => api.post('/auth/change-email/resend'), t('account.profile.newLinkSent', { email: user.pendingEmail }))} className="font-semibold underline underline-offset-2 disabled:opacity-50">{t('account.profile.resend')}</button>
            <button type="button" disabled={busy} onClick={() => run(() => api.delete('/auth/change-email'), t('account.profile.cancelled'))} className="font-semibold underline underline-offset-2 disabled:opacity-50">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder={t('account.profile.newEmail')}
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
              placeholder={t('account.profile.currentPassword')}
              autoComplete="current-password"
              onKeyDown={onEnter}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <p className="text-xs text-slate-500">{t('account.profile.changeHint')}</p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setMsg(null); }}>{t('common.cancel')}</Button>
            <Button type="button" size="sm" onClick={submit} disabled={!canSubmit}>
              {busy ? t('common.sending') : t('account.profile.sendLink')}
            </Button>
          </div>
        </div>
      )}

      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}
    </div>
  );
}

// Personnes masquées (lib/moderation.ts) : leurs messages ne s'affichent plus pour moi
function BlockedSection() {
  const { user, setUser } = useAuth();
  const [people, setPeople] = useState<{ id: string; pseudo: string; firstName: string | null }[]>([]);
  const count = user?.blockedUserIds?.length ?? 0;

  useEffect(() => {
    api.get('/moderation/blocks').then(res => setPeople(res.data)).catch(() => {});
  }, [count]);

  async function unblock(id: string) {
    const { data } = await api.delete(`/moderation/blocks/${id}`);
    setPeople(prev => prev.filter(p => p.id !== id));
    if (user) setUser({ ...user, blockedUserIds: data.blockedUserIds });
  }

  if (people.length === 0) return null;
  return (
    <div className="pt-1">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('account.profile.blocked')}</p>
      <ul className="space-y-1.5">
        {people.map(p => (
          <li key={p.id} className="flex items-center justify-between gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-slate-700 truncate">{p.firstName || p.pseudo} <span className="text-slate-400">@{p.pseudo}</span></span>
            <button type="button" onClick={() => unblock(p.id)} className="text-xs text-indigo-600 hover:text-indigo-800 flex-shrink-0">{t('account.profile.unblock')}</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 mt-1.5">{t('account.profile.blockedHint')}</p>
    </div>
  );
}
