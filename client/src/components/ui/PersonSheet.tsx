import { useEffect, useState } from 'react';
import { CalendarPlus, Check, Flag, UserPlus, X } from 'lucide-react';
import api from '../../services/api';
import { t } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useBackClose } from '../../lib/backClose';
import { photoUrl } from '../../lib/photos';
import { shortDateTime } from '../../lib/dates';
import { ContactCircle, PersonDetails } from '../../types';
import { Avatar } from './Avatar';

export interface Person { userId: string; pseudo: string; firstName?: string | null }

// Ce que la fiche peut ouvrir dans le tableau de bord (fourni par DashboardPage via PhotosProvider)
export interface PersonActions {
  openCircle: (circleId: string) => void;
  openPlan: (planId: string, circleId: string) => void;
  createPlan: (circleId: string) => void;
}

const dot = (c: ContactCircle) => <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />;

// Fiche d'une personne, ouverte en touchant son avatar (membres, chat, « Mes contacts ») : grande photo, prénom,
// @pseudo, puis (tableau de bord) Cercles et Plans à venir en commun, « Organiser un Plan », « Inviter dans un de
// mes Cercles » ; et « Signaler la photo » (exigence des stores pour le contenu publié par les utilisateurs).
export function PersonSheet({ person, photoKey, actions, onClose }: {
  person: Person; photoKey: string | null; actions?: PersonActions; onClose: () => void;
}) {
  const { user } = useAuth();
  useBackClose(onClose);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const isMe = person.userId === user?.id;
  const canReport = !!photoKey && !isMe;

  const [details, setDetails] = useState<PersonDetails | null>(null);
  const [panel, setPanel] = useState<'none' | 'organize' | 'invite'>('none');
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState('');
  useEffect(() => {
    if (!actions || isMe) return;
    api.get(`/contacts/${person.userId}`).then(res => setDetails(res.data)).catch(() => {});
  }, [person.userId, isMe, !!actions]);

  async function report() {
    setState('busy');
    try {
      await api.post('/photos/reports', { kind: 'user', targetId: person.userId, reason: reason.trim() || undefined });
      setState('done');
    } catch { setState('error'); }
  }

  async function invite(circleId: string) {
    setInviting(circleId);
    setInviteError('');
    try {
      await api.post(`/circles/${circleId}/invitations`, { identifier: person.pseudo });
      setDetails(d => d && { ...d, invitable: d.invitable.map(c => (c.id === circleId ? { ...c, invited: true } : c)) });
    } catch (err: any) {
      setInviteError(err?.response?.data?.error || t('common.retryError'));
    } finally {
      setInviting(null);
    }
  }

  function organize() {
    if (!details || !actions) return;
    if (details.circles.length === 1) { onClose(); actions.createPlan(details.circles[0].id); }
    else setPanel(p => (p === 'organize' ? 'none' : 'organize'));
  }

  const section = 'text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" aria-label={t('common.close')}><X size={18} /></button>
        <div className="text-center">
          <div className="flex justify-center">
            {photoKey
              ? <img src={photoUrl(photoKey)} alt="" className={`${details?.contact ? 'w-28 h-28' : 'w-40 h-40'} rounded-full object-cover bg-slate-200`} />
              : <Avatar pseudo={person.pseudo} size="xxl" noPhoto />}
          </div>
          {person.firstName && <p className="mt-4 text-lg font-semibold text-slate-900">{person.firstName}</p>}
          <p className={person.firstName ? 'text-sm text-slate-400' : 'mt-4 text-lg font-semibold text-slate-900'}>@{person.pseudo}</p>
        </div>

        {details && actions && (details.contact || details.plans.length > 0) && (
          <div className="mt-5 space-y-4 text-left">
            {details.circles.length > 0 && (
              <div>
                <p className={section}>{t('circle.contacts.sharedCircles')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.circles.map(c => (
                    <button key={c.id} onClick={() => { onClose(); actions.openCircle(c.id); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 max-w-full">
                      {dot(c)}<span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className={section}>{t('circle.contacts.sharedPlans')}</p>
              {details.plans.length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t('circle.contacts.noPlans')}</p>
              ) : (
                <div className="space-y-1.5">
                  {details.plans.map(p => (
                    <button key={p.id} onClick={() => { onClose(); actions.openPlan(p.id, p.circleId); }}
                      className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                      {p.eventDate && <p className="text-xs text-slate-400">{shortDateTime(p.eventDate)}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {details.contact && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={organize}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${panel === 'organize' ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                  <CalendarPlus size={15} />{t('circle.contacts.organize')}
                </button>
                <button onClick={() => setPanel(p => (p === 'invite' ? 'none' : 'invite'))}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${panel === 'invite' ? 'bg-slate-100 border-slate-300 text-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  <UserPlus size={15} />{t('circle.contacts.invite')}
                </button>
              </div>
            )}

            {panel === 'organize' && (
              <div>
                <p className={section}>{t('circle.contacts.organizeIn')}</p>
                <div className="space-y-1.5">
                  {details.circles.map(c => (
                    <button key={c.id} onClick={() => { onClose(); actions.createPlan(c.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm text-slate-800">
                      {dot(c)}<span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === 'invite' && (
              <div>
                <p className={section}>{t('circle.contacts.inviteTo')}</p>
                {details.invitable.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">{t('circle.contacts.noInvitable')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {details.invitable.map(c => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200">
                        {dot(c)}<span className="flex-1 min-w-0 truncate text-sm text-slate-800">{c.name}</span>
                        {c.invited ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check size={13} />{t('circle.contacts.invited')}</span>
                        ) : (
                          <button onClick={() => invite(c.id)} disabled={inviting === c.id}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                            {inviting === c.id ? '…' : t('circle.contacts.invite')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {inviteError && <p className="text-xs text-red-600 mt-1.5">{inviteError}</p>}
              </div>
            )}
          </div>
        )}

        {canReport && (
          <div className="text-center">
            {state === 'done' ? (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
