import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';
import { t } from '../i18n';

// Page publique /desinscription?t=<jeton> (2026-11-24) : désinscription d'un résumé envoyé par email (résumé hebdomadaire, résumé
// du lundi du cockpit) en un clic, sans connexion. Serveur : routes/unsubscribe.ts. Un bouton plutôt qu'une désinscription à
// l'ouverture : les messageries ouvrent parfois les liens toutes seules pour les vérifier.
type Info = { kind: 'digest' | 'cockpit'; active: boolean; organisation: string | null };

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'done' | 'invalid'>('loading');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    api.get<Info>('/unsubscribe/info', { params: { t: token } })
      .then(r => { setInfo(r.data); setState(r.data.active ? 'ready' : 'done'); })
      .catch(() => setState('invalid'));
  }, [token]);

  async function confirm() {
    setState('sending');
    try { await api.post('/unsubscribe', null, { params: { t: token } }); setState('done'); } catch { setState('invalid'); }
  }

  const what = info?.kind === 'cockpit' ? t('legal.unsub.cockpit', { org: info.organisation ?? '' }) : t('legal.unsub.digest');
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-7 text-center space-y-4 text-slate-700">
        <div className="flex justify-center"><LogoIcon size={40} light /></div>
        <h1 className="text-xl font-bold text-slate-900">{t('legal.unsub.title')}</h1>
        {state === 'loading' && <p className="flex items-center justify-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin" /> {t('legal.unsub.loading')}</p>}
        {(state === 'ready' || state === 'sending') && (
          <>
            <p>{what}</p>
            <button onClick={confirm} disabled={state === 'sending'}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {state === 'sending' ? <Loader2 size={17} className="animate-spin" /> : <MailX size={17} />} {t('legal.unsub.button')}
            </button>
          </>
        )}
        {state === 'done' && (
          <>
            <p className="flex items-center justify-center gap-2 font-semibold text-emerald-700"><CheckCircle2 size={18} /> {info?.active === false ? t('legal.unsub.already') : t('legal.unsub.done')}</p>
            <p className="text-sm text-slate-500">{what}</p>
            <p className="text-sm text-slate-500">{t('legal.unsub.again')}</p>
          </>
        )}
        {state === 'invalid' && <p>{t('legal.unsub.invalid')}</p>}
        <p className="pt-2 text-xs text-slate-400"><Link to="/mentions-legales" className="underline">{t('legal.notice.title')}</Link></p>
      </div>
    </div>
  );
}
