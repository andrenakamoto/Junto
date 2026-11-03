import { useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { t } from '../../i18n';
import { useBackClose } from '../../lib/backClose';
import { LogoFull } from './Logo';

// Premier lancement (2026-11-03) : un compte qui n'a encore ni Cercle ni Plan arrive sur trois choix plutôt que sur une
// liste vide. « Organiser une sortie » ouvre la création d'un Plan (« Juste un lien » par défaut), « Rejoindre mes amis »
// accepte un code ou un lien collé, « Créer mon groupe » ouvre la création d'un Cercle. « Plus tard » le ferme sur cet
// appareil (DashboardPage) ; il ne revient de toute façon plus dès qu'il y a un Cercle ou un Plan.
export function WelcomeScreen({ firstName, onOrganize, onCreateGroup, onJoin, onDemo, onLater }: {
  firstName?: string | null;
  onOrganize: () => void; onCreateGroup: () => void; onJoin: (value: string) => string | null; onDemo: () => void; onLater: () => void;
}) {
  const [joining, setJoining] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useBackClose(onLater);

  const card = (emoji: string, title: string, text: string, onClick: () => void) => (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-md text-left hover:border-indigo-300">
      <span className="w-12 h-12 flex-shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500 mt-0.5">{text}</span>
      </span>
      <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-100 overflow-y-auto" style={{ paddingTop: 'var(--sa-top, 0px)', paddingBottom: 'var(--sa-bottom, 0px)' }}>
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-center"><LogoFull light iconSize={30} /></div>
        <h1 className="text-2xl font-bold text-slate-900 text-center">
          {firstName ? t('ui.welcome.hello', { name: firstName }) : t('ui.welcome.helloAnon')}
        </h1>
        {!joining ? (
          <div className="space-y-3">
            {card('🎉', t('ui.welcome.organize'), t('ui.welcome.organizeText'), onOrganize)}
            {card('👋', t('ui.welcome.join'), t('ui.welcome.joinText'), () => setJoining(true))}
            {card('👥', t('ui.welcome.group'), t('ui.welcome.groupText'), onCreateGroup)}
          </div>
        ) : (
          <form className="space-y-3 bg-white rounded-2xl border border-slate-200 shadow-md p-4"
            onSubmit={e => { e.preventDefault(); const err = onJoin(value.trim()); if (err) setError(err); }}>
            <button type="button" onClick={() => { setJoining(false); setError(''); }} className="flex items-center gap-1 text-sm text-slate-500"><ArrowLeft size={14} />{t('common.back')}</button>
            <p className="font-semibold text-slate-900">{t('ui.welcome.join')}</p>
            <input autoFocus value={value} onChange={e => { setValue(e.target.value); setError(''); }} placeholder={t('ui.welcome.joinPlaceholder')}
              className="w-full px-3 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold">{t('ui.welcome.joinButton')}</button>
          </form>
        )}
        <div className="flex items-center justify-center gap-4 text-sm">
          <button onClick={onLater} className="text-slate-500 underline">{t('ui.welcome.later')}</button>
          <button onClick={onDemo} className="text-indigo-600 font-semibold">{t('ui.welcome.demo')}</button>
        </div>
      </div>
    </div>
  );
}

// Code ou lien collé dans « Rejoindre mes amis » : adresse interne à ouvrir, ou null si rien n'est reconnu
export function joinTarget(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const token = /[?&]token=([A-Za-z0-9_-]+)/.exec(v)?.[1];
  if (token && /invitation/.test(v)) return `/invitation?token=${token}`;
  const code = /[?&]code=([A-Za-z0-9]+)/.exec(v)?.[1] ?? (/^[A-Za-z0-9]{4,12}$/.test(v) ? v : null);
  return code ? `/rejoindre?code=${code.toUpperCase()}` : null;
}
