import { useEffect, useRef, useState } from 'react';
import { useResync } from '../../hooks/useResync';
import { CalendarPlus, ChevronLeft, Clock, Flag, Megaphone, MessageCircle, SmilePlus, Trash2, X } from 'lucide-react';
import { Circle, CircleMessage, Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { Avatar } from '../ui/Avatar';
import { ChatInput } from '../chat/ChatInput';
import { renderContent } from '../chat/ChatMessage';
import { SavePhotoButton } from '../chat/SavePhotoButton';
import { DeletedBubble, MessageEditor, OwnMessageActions, useEditWindow } from '../chat/MessageEditing';
import { ReportMessageModal } from '../chat/ReportMessageModal';
import { CreatePlanModal } from '../plans/CreatePlanModal';
import { REACTION_EMOJIS } from '../../lib/reactions';
import { useBackClose } from '../../lib/backClose';
import { photoUrl } from '../../lib/photos';
import { isCircleManager } from '../../lib/settings';
import api from '../../services/api';
import { intlLocale, t } from '../../i18n';

// Réactions communes à tous les chats (lib/reactions.ts)
const QUICK_EMOJIS = REACTION_EMOJIS;

interface Props {
  circle: Circle;
  onBack: () => void;
  /** La discussion a été lue (pastille du Cercle) */
  onSeen: (circleId: string) => void;
  onPlanCreated: (plan: Plan) => void;
}

// Discussion d'un Cercle (serveur : routes/circleChat.ts) : messages des 7 derniers jours, réactions, photos,
// mentions ; « Faire un Plan » transforme un message en Plan. Mode « Annonces » : seuls le créateur et les
// organisateurs écrivent.
export function CircleChat({ circle, onBack, onSeen, onPlanCreated }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<{ mode: string; canWrite: boolean; canModerate: boolean; messages: CircleMessage[] } | null>(null);
  const [reporting, setReporting] = useState<CircleMessage | null>(null);
  const [planFrom, setPlanFrom] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  useBackClose(() => setViewing(null), !!viewing);
  const endRef = useRef<HTMLDivElement>(null);
  const blocked = new Set(user?.blockedUserIds ?? []);

  const markSeen = () => { api.post(`/circle-chat/${circle.id}/seen`).catch(() => {}); onSeen(circle.id); };
  const load = () => api.get(`/circle-chat/${circle.id}`).then(r => setData(r.data)).catch(() => {});
  useEffect(() => { setData(null); load(); markSeen(); }, [circle.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.messages.length]);

  const replace = (m: CircleMessage) => setData(d => d && { ...d, messages: d.messages.map(x => x.id === m.id ? m : x) });
  useSocketEvent<{ circleId: string; message: CircleMessage }>('circle-message', p => {
    if (p.circleId !== circle.id) return;
    setData(d => d && (d.messages.some(m => m.id === p.message.id) ? d : { ...d, messages: [...d.messages, p.message] }));
    markSeen();
  });
  useSocketEvent<{ circleId: string; message: CircleMessage }>('circle-message-updated', p => { if (p.circleId === circle.id) replace(p.message); });
  useSocketEvent<{ circleId: string }>('circle-updated', p => { if (p.circleId === circle.id) load(); });
  useSocketEvent('connect', () => { load(); });
  useResync(load);

  if (!user) return null;
  const isManager = isCircleManager(circle, user.id);
  const canCreatePlan = circle.planCreationMode !== 'creator' || isManager;
  const messages = (data?.messages ?? []).filter(m => !blocked.has(m.author.id));

  async function send(content: string) {
    const { data: m } = await api.post(`/circle-chat/${circle.id}/messages`, { content });
    setData(d => d && (d.messages.some(x => x.id === m.id) ? d : { ...d, messages: [...d.messages, m] }));
  }
  async function sendPhoto(file: File, caption: string) {
    const fd = new FormData();
    fd.append('file', file);
    const { data: up } = await api.post(`/circle-chat/${circle.id}/photo`, fd);
    const { data: m } = await api.post(`/circle-chat/${circle.id}/messages`, { content: caption, imageKey: up.imageKey });
    setData(d => d && (d.messages.some(x => x.id === m.id) ? d : { ...d, messages: [...d.messages, m] }));
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden short:overflow-y-auto">
      <div className="px-4 md:px-6 py-3 border-b border-slate-200 flex-shrink-0 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0" aria-label={t('common.back')}>
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">{circle.name}</p>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <MessageCircle size={16} className="text-indigo-500" />{t('circle.chat.title')}
            {data?.mode === 'announce' && (
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Megaphone size={11} />{t('circle.chat.announce')}
              </span>
            )}
          </h1>
        </div>
      </div>
      <p className="px-4 md:px-6 py-1.5 text-[11px] text-slate-400 flex items-center gap-1 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        <Clock size={11} />{t('circle.chat.ttl')}
      </p>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3 bg-slate-50 short:flex-none short:overflow-visible">
        {!data ? (
          <p className="text-center text-slate-400 text-sm pt-12">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-slate-400 text-sm pt-12">{t('circle.chat.empty')}</p>
        ) : messages.map(m => (
          <CircleChatMessage
            key={m.id}
            message={m}
            isMe={m.author.id === user.id}
            userId={user.id}
            canModerate={!!data.canModerate}
            canCreatePlan={canCreatePlan}
            onReact={emoji => api.post(`/circle-chat/messages/${m.id}/reactions`, { emoji }).then(r => replace(r.data)).catch(() => {})}
            onEdit={content => api.put(`/circle-chat/messages/${m.id}`, { content }).then(r => replace(r.data)).catch(() => {})}
            onDelete={() => api.delete(`/circle-chat/messages/${m.id}`).then(r => replace(r.data)).catch(() => {})}
            onReport={() => setReporting(m)}
            onMakePlan={() => setPlanFrom(m.content.split('\n')[0].slice(0, 100))}
            onViewPhoto={setViewing}
          />
        ))}
        <div ref={endRef} />
      </div>

      {data && (data.canWrite ? (
        <ChatInput onSend={content => { send(content).catch(() => {}); }} onSendPhoto={sendPhoto} members={circle.members.map(m => ({ pseudo: m.user.pseudo }))} />
      ) : (
        <p className="px-4 py-3 text-xs text-slate-500 bg-white border-t border-slate-200 flex items-center gap-2 short:sticky short:bottom-0">
          <Megaphone size={14} className="text-amber-600 flex-shrink-0" />{t('circle.chat.announceOnly')}
        </p>
      ))}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" style={{ marginTop: 'var(--sa-top)' }} aria-label={t('common.close')}><X size={20} /></button>
          <img src={photoUrl(viewing)} alt="" className="max-w-full max-h-full object-contain" />
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 'calc(1.5rem + var(--sa-bottom, 0px))' }}>
            <SavePhotoButton url={photoUrl(viewing)} filename={`${circle.name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 60)} - photo.jpg`} />
          </div>
        </div>
      )}
      {reporting && <ReportMessageModal kind="circle" messageId={reporting.id} author={reporting.author} onClose={() => setReporting(null)} />}
      {planFrom !== null && (
        <CreatePlanModal
          circleId={circle.id}
          circleMembers={circle.members}
          suggestedTitle={planFrom}
          onClose={() => setPlanFrom(null)}
          onCreated={plan => { setPlanFrom(null); onPlanCreated(plan); }}
        />
      )}
    </div>
  );
}

function CircleChatMessage({ message: m, isMe, userId, canModerate, canCreatePlan, onReact, onEdit, onDelete, onReport, onMakePlan, onViewPhoto }: {
  message: CircleMessage; isMe: boolean; userId: string; canModerate: boolean; canCreatePlan: boolean;
  onReact: (emoji: string) => void; onEdit: (content: string) => void; onDelete: () => void; onReport: () => void;
  onMakePlan: () => void; onViewPhoto: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Liste des réactions ouverte : un toucher ou un clic n'importe où ailleurs la referme
  useEffect(() => {
    if (!picker) return;
    const close = (e: PointerEvent) => { if (!pickerRef.current?.contains(e.target as Node)) setPicker(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [picker]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = useEditWindow(m.createdAt, m.deletedAt ?? null, isMe);
  const time = new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(m.createdAt))
    + (m.editedAt && !m.deletedAt ? t('chat.message.edited') : '');
  // Réactions regroupées : emoji → personnes
  const groups = new Map<string, string[]>();
  for (const r of m.reactions) groups.set(r.emoji, [...(groups.get(r.emoji) ?? []), r.userId]);

  return (
    <div className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
      {!isMe && <Avatar pseudo={m.author.pseudo} size="sm" person={{ userId: m.author.id, pseudo: m.author.pseudo, firstName: m.author.firstName }} />}
      <div className={`max-w-xs lg:max-w-md flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2">
          {!isMe && <span className="text-xs font-semibold text-slate-600">{m.author.pseudo}</span>}
          <span className="text-xs text-slate-400">{time}</span>
        </div>
        {m.deletedAt ? (
          <DeletedBubble isMe={isMe} />
        ) : editing ? (
          <MessageEditor initial={m.content} onCancel={() => setEditing(false)} onSave={text => { setEditing(false); onEdit(text); }} />
        ) : (
          <>
            {m.imageKey && (
              <button type="button" onClick={() => onViewPhoto(m.imageKey!)} className="block rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img src={photoUrl(m.imageKey, true)} alt="" loading="lazy" className="max-w-[240px] max-h-[320px] object-cover block" />
              </button>
            )}
            {m.content && (
              <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
              }`}>
                {renderContent(m.content, isMe)}
              </div>
            )}
          </>
        )}
        {!m.deletedAt && groups.size > 0 && (
          <div className="flex flex-wrap gap-1">
            {[...groups].map(([emoji, ids]) => (
              <button key={emoji} type="button" onClick={() => onReact(emoji)}
                className={`px-1.5 py-0.5 rounded-full text-xs border ${ids.includes(userId) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200'}`}>
                {emoji} {ids.length}
              </button>
            ))}
          </div>
        )}
        {!m.deletedAt && !editing && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 ${isMe ? 'justify-end' : ''}`}>
            {picker ? (
              <div ref={pickerRef} className="grid grid-cols-8 gap-0.5 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-lg">
                {QUICK_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => { setPicker(false); onReact(e); }} aria-label={e}
                    className="text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 hover:scale-110 active:scale-95 transition-transform">{e}</button>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => setPicker(true)} title={t('circle.chat.react')} className="hover:text-indigo-600"><SmilePlus size={13} /></button>
            )}
            {canCreatePlan && m.content && (
              <button type="button" onClick={onMakePlan} title={t('circle.chat.makePlanTitle')} className="flex items-center gap-1 hover:text-indigo-600">
                <CalendarPlus size={12} />{t('circle.chat.makePlan')}
              </button>
            )}
            {editable && <OwnMessageActions onEdit={m.imageKey && !m.content ? undefined : () => setEditing(true)} onDelete={onDelete} />}
            {!editable && canModerate && (confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-slate-500">{t('circle.chat.deleteConfirm')}</span>
                <button type="button" onClick={() => { setConfirmDelete(false); onDelete(); }} className="font-semibold text-red-600 hover:underline">{t('common.yes')}</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="hover:underline">{t('common.no')}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} title={t('circle.chat.delete')} aria-label={t('circle.chat.delete')} className="hover:text-red-500"><Trash2 size={12} /></button>
            ))}
            {!isMe && (
              <button type="button" onClick={onReport} title={t('chat.message.reportTitle')} aria-label={t('chat.message.report')} className="text-slate-300 hover:text-red-500">
                <Flag size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
