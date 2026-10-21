import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { AdmissionMode, Circle, DeletionMode, PlanCreationMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AdmissionModeField, AvailabilityField, ChatModeField, DeletionModeField, PlanCreationModeField, PollCreationModeField } from '../ui/AdvancedSettings';
import api from '../../services/api';
import { ADMISSION_OPTIONS, CHAT_MODE_OPTIONS, ChatMode, DELETION_OPTIONS, isCircleManager, PLAN_CREATION_OPTIONS, POLL_CREATION_OPTIONS } from '../../lib/settings';
import { intlLocale, t } from '../../i18n';
import { CirclePhotoField, PendingPhoto, applyCirclePhoto } from './CirclePhotoField';
import { CIRCLE_COLORS } from './CreateCircleModal';
import { photoUrl } from '../../lib/photos';
import { Flag } from 'lucide-react';

interface Props {
  circle: Circle;
  onClose: () => void;
  onUpdated: (circle: Circle) => void;
}

// Paramètres avancés du Cercle : modifiables par le créateur, visibles par tous les membres
export function CircleSettingsModal({ circle, onClose, onUpdated }: Props) {
  const { user } = useAuth();
  const isCreator = circle.creatorId === user?.id;
  const canEdit = isCircleManager(circle, user?.id);
  const [deletionMode, setDeletionMode] = useState<DeletionMode>(circle.deletionMode ?? 'vote');
  const [admissionMode, setAdmissionMode] = useState<AdmissionMode>(circle.admissionMode ?? 'vote');
  const [planCreationMode, setPlanCreationMode] = useState<PlanCreationMode>(circle.planCreationMode ?? 'all');
  const [pollCreationMode, setPollCreationMode] = useState<PlanCreationMode>(circle.pollCreationMode ?? 'all');
  const [chatMode, setChatMode] = useState<ChatMode>(circle.chatMode ?? 'off');
  const [availabilityEnabled, setAvailabilityEnabled] = useState(circle.availabilityEnabled !== false);
  const [availabilityThreshold, setAvailabilityThreshold] = useState(circle.availabilityThreshold ?? 3);
  const [name, setName] = useState(circle.name);
  const [description, setDescription] = useState(circle.description ?? '');
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<PendingPhoto>(null);
  const [color, setColor] = useState<string | null>(circle.color ?? null);
  const [error, setError] = useState('');

  const pendingCount = circle.joinRequests?.length ?? 0;
  const willOpen = admissionMode === 'open' && circle.admissionMode !== 'open' && pendingCount > 0;
  const changed = deletionMode !== (circle.deletionMode ?? 'vote') || admissionMode !== (circle.admissionMode ?? 'vote')
    || planCreationMode !== (circle.planCreationMode ?? 'all') || pollCreationMode !== (circle.pollCreationMode ?? 'all') || chatMode !== (circle.chatMode ?? 'off')
    || availabilityEnabled !== (circle.availabilityEnabled !== false) || availabilityThreshold !== (circle.availabilityThreshold ?? 3)
    || description.trim() !== (circle.description ?? '') || (name.trim() !== circle.name && name.trim().length > 0);
  const settingsChanged = changed;
  const colorChanged = color !== (circle.color ?? null);
  const anyChange = changed || photo !== null || colorChanged;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // Photo d'abord (elle a sa propre route), puis les réglages s'ils ont changé
      const key = await applyCirclePhoto(circle.id, photo);
      let updated: Circle = { ...circle, ...(key !== undefined ? { photoKey: key } : {}) };
      if (colorChanged) {
        const { data } = await api.put(`/circles/${circle.id}/color`, { color });
        updated = { ...updated, color: data.color };
      }
      if (settingsChanged) {
        const { data } = await api.put(`/circles/${circle.id}/settings`, { deletionMode, admissionMode, planCreationMode, pollCreationMode, chatMode, availabilityEnabled, availabilityThreshold, description, name: name.trim() });
        updated = { ...data, color: updated.color, ...(key !== undefined ? { photoKey: key } : {}) };
      }
      onUpdated(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t('circle.settings.title')} onClose={onClose}>
      <div className="space-y-4">
        {canEdit
          ? <CirclePhotoField currentKey={circle.photoKey ?? null} pending={photo} onPending={setPhoto} />
          : <CirclePhotoView circle={circle} />}
        {canEdit && (
          // Couleur du Cercle (contour de sa carte) : choisie ici depuis le 2026-10-17, plus par une pastille sur la carte
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.create.color')}</label>
            <div className="flex gap-2 flex-wrap">
              {CIRCLE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(color === c ? null : c)} style={{ backgroundColor: c }} aria-label={c} aria-pressed={color === c}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>
        )}
        {canEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.settings.name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
            />
            {name.trim() !== circle.name && name.trim() && (
              <p className="text-xs text-slate-500 mt-1">{t('circle.settings.renameHint')}</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('circle.settings.description')}</label>
          {canEdit ? (
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('circle.settings.descriptionPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 resize-none text-sm"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-line break-words">{circle.description || <span className="italic text-slate-400">{t('circle.settings.noDescription')}</span>}</p>
          )}
        </div>
        <AdmissionModeField value={admissionMode} onChange={setAdmissionMode} readOnly={!canEdit} />
        {willOpen && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {t('circle.settings.willAccept', { count: pendingCount })}
          </p>
        )}
        <PlanCreationModeField value={planCreationMode} onChange={setPlanCreationMode} readOnly={!canEdit} />
        <PollCreationModeField value={pollCreationMode} onChange={setPollCreationMode} readOnly={!canEdit} />
        <ChatModeField value={chatMode} onChange={setChatMode} readOnly={!canEdit} />
        <AvailabilityField enabled={availabilityEnabled} onEnabledChange={setAvailabilityEnabled} threshold={availabilityThreshold} onThresholdChange={setAvailabilityThreshold} readOnly={!canEdit} />
        <DeletionModeField subject="Cercle" value={deletionMode} onChange={setDeletionMode} readOnly={!isCreator} />
        <CircleHistory circleId={circle.id} />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          {canEdit ? (
            <>
              <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving || !anyChange}>{saving ? t('common.saving') : t('common.save')}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mr-auto self-center">{t('circle.settings.managersOnly')}</p>
              <Button onClick={onClose}>{t('common.close')}</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface ChangeLog { id: string; field: string; oldValue: string | null; newValue: string | null; changedAt: string; changedBy: { pseudo: string } | null }

const FIELDS = ['name', 'description', 'photo', 'admissionMode', 'planCreationMode', 'pollCreationMode', 'chatMode', 'availabilityEnabled', 'availabilityThreshold', 'deletionMode'];
const fieldLabel = (field: string) => FIELDS.includes(field) ? t(`circle.settings.fields.${field}` as any) : field;
const VALUE_LABELS: Record<string, Record<string, string>> = {
  admissionMode: Object.fromEntries(ADMISSION_OPTIONS.map(o => [o.value, o.label])),
  planCreationMode: Object.fromEntries(PLAN_CREATION_OPTIONS.map(o => [o.value, o.label])),
  pollCreationMode: Object.fromEntries(POLL_CREATION_OPTIONS.map(o => [o.value, o.label])),
  deletionMode: Object.fromEntries(DELETION_OPTIONS.map(o => [o.value, o.label])),
  photo: { photo: t('photos.historyPhoto') },
  chatMode: Object.fromEntries(CHAT_MODE_OPTIONS.map(o => [o.value, o.label])),
  availabilityEnabled: { true: t('settings.dispo.on.label'), false: t('settings.dispo.off.label') },
};
const label = (field: string, v: string | null) => (v ? VALUE_LABELS[field]?.[v] ?? v : '—');
const dateFmt = new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Historique des modifications du Cercle (serveur : CircleChangeLog), replié par défaut
function CircleHistory({ circleId }: { circleId: string }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ChangeLog[] | null>(null);
  useEffect(() => {
    if (open && !logs) api.get(`/circles/${circleId}/history`).then(res => setLogs(res.data)).catch(() => setLogs([]));
  }, [open, logs, circleId]);

  return (
    <div className="border-t border-slate-100 pt-3">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700">
        <History size={13} /> {t('circle.settings.history')} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
          {logs === null ? (
            <p className="text-xs text-slate-400">{t('common.loading')}</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('circle.settings.noHistory')}</p>
          ) : logs.map(l => (
            <div key={l.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-slate-500">
                {dateFmt.format(new Date(l.changedAt))} · {l.changedBy ? `@${l.changedBy.pseudo}` : t('circle.settings.deletedAccount')}
              </p>
              <p className="text-slate-700 mt-0.5 break-words">
                <strong>{fieldLabel(l.field)}</strong> : {label(l.field, l.oldValue)} → {label(l.field, l.newValue)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Photo du Cercle vue par un membre qui ne la gère pas : affichage et « Signaler la photo »
function CirclePhotoView({ circle }: { circle: Circle }) {
  const [report, setReport] = useState<'idle' | 'open' | 'busy' | 'done'>('idle');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  if (!circle.photoKey) return null;
  async function sendReport() {
    setReport('busy'); setError('');
    try { await api.post('/photos/reports', { kind: 'circle', targetId: circle.id, reason: reason.trim() || undefined }); setReport('done'); }
    catch { setReport('open'); setError(t('common.error')); }
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('photos.circleLabel')}</label>
      <img src={photoUrl(circle.photoKey)} alt="" className="w-full aspect-[2/1] object-cover rounded-xl bg-slate-200" />
      {report === 'done' ? (
        <p className="mt-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{t('photos.reported')}</p>
      ) : report === 'idle' ? (
        <button type="button" onClick={() => setReport('open')} className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600"><Flag size={12} />{t('photos.report')}</button>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} placeholder={t('photos.reportReason')}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setReport('idle')} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button>
            <button type="button" onClick={sendReport} disabled={report === 'busy'} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50">{t('photos.reportSend')}</button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
}
