import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { AdmissionMode, Circle, DeletionMode, PlanCreationMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AdmissionModeField, DeletionModeField, PlanCreationModeField, PollCreationModeField } from '../ui/AdvancedSettings';
import api from '../../services/api';
import { ADMISSION_OPTIONS, DELETION_OPTIONS, isCircleManager, PLAN_CREATION_OPTIONS, POLL_CREATION_OPTIONS } from '../../lib/settings';

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
  const [name, setName] = useState(circle.name);
  const [description, setDescription] = useState(circle.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pendingCount = circle.joinRequests?.length ?? 0;
  const willOpen = admissionMode === 'open' && circle.admissionMode !== 'open' && pendingCount > 0;
  const changed = deletionMode !== (circle.deletionMode ?? 'vote') || admissionMode !== (circle.admissionMode ?? 'vote')
    || planCreationMode !== (circle.planCreationMode ?? 'all') || pollCreationMode !== (circle.pollCreationMode ?? 'all')
    || description.trim() !== (circle.description ?? '') || (name.trim() !== circle.name && name.trim().length > 0);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(`/circles/${circle.id}/settings`, { deletionMode, admissionMode, planCreationMode, pollCreationMode, description, name: name.trim() });
      onUpdated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Paramètres du Cercle" onClose={onClose}>
      <div className="space-y-4">
        {canEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nom du Cercle</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 text-sm"
            />
            {name.trim() !== circle.name && name.trim() && (
              <p className="text-xs text-slate-500 mt-1">Les membres seront prévenus. Le code et les liens d'invitation restent valables.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description du Cercle</label>
          {canEdit ? (
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="À quoi sert ce Cercle ?"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 resize-none text-sm"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-line break-words">{circle.description || <span className="italic text-slate-400">Pas de description.</span>}</p>
          )}
        </div>
        <AdmissionModeField value={admissionMode} onChange={setAdmissionMode} readOnly={!canEdit} />
        {willOpen && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente {pendingCount > 1 ? 'seront acceptées' : 'sera acceptée'} automatiquement.
          </p>
        )}
        <PlanCreationModeField value={planCreationMode} onChange={setPlanCreationMode} readOnly={!canEdit} />
        <PollCreationModeField value={pollCreationMode} onChange={setPollCreationMode} readOnly={!canEdit} />
        <DeletionModeField subject="Cercle" value={deletionMode} onChange={setDeletionMode} readOnly={!isCreator} />
        <CircleHistory circleId={circle.id} />
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          {canEdit ? (
            <>
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving || !changed}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 mr-auto self-center">Seuls le créateur et les organisateurs peuvent les modifier.</p>
              <Button onClick={onClose}>Fermer</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface ChangeLog { id: string; field: string; oldValue: string | null; newValue: string | null; changedAt: string; changedBy: { pseudo: string } | null }

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', description: 'Description', admissionMode: 'Admission',
  planCreationMode: 'Création des Plans', pollCreationMode: 'Création des sondages', deletionMode: 'Suppression du Cercle',
};
const VALUE_LABELS: Record<string, Record<string, string>> = {
  admissionMode: Object.fromEntries(ADMISSION_OPTIONS.map(o => [o.value, o.label])),
  planCreationMode: Object.fromEntries(PLAN_CREATION_OPTIONS.map(o => [o.value, o.label])),
  pollCreationMode: Object.fromEntries(POLL_CREATION_OPTIONS.map(o => [o.value, o.label])),
  deletionMode: Object.fromEntries(DELETION_OPTIONS.map(o => [o.value, o.label])),
};
const label = (field: string, v: string | null) => (v ? VALUE_LABELS[field]?.[v] ?? v : '—');
const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
        <History size={13} /> Historique des modifications {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
          {logs === null ? (
            <p className="text-xs text-slate-400">Chargement…</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Aucune modification pour l'instant.</p>
          ) : logs.map(l => (
            <div key={l.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-slate-500">
                {dateFmt.format(new Date(l.changedAt))} · {l.changedBy ? `@${l.changedBy.pseudo}` : 'compte supprimé'}
              </p>
              <p className="text-slate-700 mt-0.5 break-words">
                <strong>{FIELD_LABELS[l.field] ?? l.field}</strong> : {label(l.field, l.oldValue)} → {label(l.field, l.newValue)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
