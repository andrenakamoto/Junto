import { useState } from 'react';
import { Pencil, Pin, Plus } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { renderContent } from '../chat/ChatMessage';
import { t } from '../../i18n';

export const IMPORTANT_INFO_MAX = 500;

// Informations importantes du Plan (après la description) : code d'entrée, documents à
// prendre, heure de départ… Modifiables par le créateur, ou par tous les participants selon
// le paramètre avancé « Modification des informations importantes » (indépendant des dates et du lieu).
export function ImportantInfoCard({ plan, userId, onChanged }: { plan: Plan; userId: string; onChanged: () => Promise<void> | void }) {
  const isMember = plan.members.some(m => m.userId === userId);
  const canEdit = plan.creatorId === userId || (plan.importantInfoMode === 'all' && isMember);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startEditing() {
    setText(plan.importantInfo ?? '');
    setError('');
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/plans/${plan.id}/important-info`, { importantInfo: text });
      await onChanged();
      setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || t('plan.importantInfo.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-300 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
          <Pin size={15} className="text-amber-600" />
          {t('plan.importantInfo.title')}
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value.slice(0, IMPORTANT_INFO_MAX))}
          rows={4}
          placeholder={t('plan.importantInfo.placeholder')}
          className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700/70 mr-auto">{text.length}/{IMPORTANT_INFO_MAX}</span>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50">{t('common.cancel')}</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (!plan.importantInfo) {
    if (!canEdit) return null;
    return (
      <button
        onClick={startEditing}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-amber-300 text-sm text-amber-800 hover:bg-amber-50"
      >
        <Plus size={15} /> {t('plan.importantInfo.add')}
      </button>
    );
  }

  return (
    <div className="bg-amber-50 rounded-xl p-4 border border-amber-300 shadow-sm">
      <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-1">
        <Pin size={15} className="text-amber-600" />
        {t('plan.importantInfo.title')}
        {canEdit && (
          <button onClick={startEditing} title={t('plan.importantInfo.edit')} className="ml-auto p-1 rounded-md text-amber-700 hover:bg-amber-100">
            <Pencil size={14} />
          </button>
        )}
      </div>
      <p className="text-slate-800 text-sm pl-5 leading-relaxed whitespace-pre-line break-words">{renderContent(plan.importantInfo, false)}</p>
    </div>
  );
}
