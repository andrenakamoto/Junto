import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import api from '../../services/api';
import { t } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useBackClose } from '../../lib/backClose';
import { photoUrl } from '../../lib/photos';
import { Avatar } from './Avatar';

export interface Person { userId: string; pseudo: string; firstName?: string | null }

// Fiche d'une personne, ouverte en touchant son avatar (membres, chat) : grande photo, prénom, @pseudo,
// et « Signaler la photo » (exigence des stores pour le contenu publié par les utilisateurs).
export function PersonSheet({ person, photoKey, onClose }: { person: Person; photoKey: string | null; onClose: () => void }) {
  const { user } = useAuth();
  useBackClose(onClose);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const canReport = !!photoKey && person.userId !== user?.id;

  async function report() {
    setState('busy');
    try {
      await api.post('/photos/reports', { kind: 'user', targetId: person.userId, reason: reason.trim() || undefined });
      setState('done');
    } catch { setState('error'); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label={t('common.close')}><X size={18} /></button>
        <div className="flex justify-center">
          {photoKey
            ? <img src={photoUrl(photoKey)} alt="" className="w-40 h-40 rounded-full object-cover bg-slate-200" />
            : <Avatar pseudo={person.pseudo} size="xxl" noPhoto />}
        </div>
        {person.firstName && <p className="mt-4 text-lg font-semibold text-slate-900">{person.firstName}</p>}
        <p className={person.firstName ? 'text-sm text-slate-400' : 'mt-4 text-lg font-semibold text-slate-900'}>@{person.pseudo}</p>
        {canReport && (state === 'done' ? (
          <p className="mt-5 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{t('photos.reported')}</p>
        ) : reporting ? (
          <div className="mt-5 text-left space-y-2">
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} placeholder={t('photos.reportReason')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {state === 'error' && <p className="text-xs text-red-500">{t('common.error')}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReporting(false)} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
              <button onClick={report} disabled={state === 'busy'} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50">{t('photos.reportSend')}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setReporting(true)} className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600">
            <Flag size={12} />{t('photos.report')}
          </button>
        ))}
      </div>
    </div>
  );
}
