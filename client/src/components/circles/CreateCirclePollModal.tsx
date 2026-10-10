import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { CirclePoll, CircleMember } from '../../types';
import { SurpriseSelector } from '../plans/SurpriseSelector';
import { useAuth } from '../../contexts/AuthContext';
import { DateTimeField } from '../ui/DateTimeField';
import { t } from '../../i18n';
import { shortDateTime } from '../../lib/dates';

function localDateTimeToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function formatOptionLabel(localDateTime: string): string {
  const iso = localDateTimeToISO(localDateTime);
  return shortDateTime(iso);
}

interface Props {
  circleId: string;
  /** Membres du Cercle, pour choisir à qui cacher le sondage */
  circleMembers?: CircleMember[];
  onClose: () => void;
  onCreated: (poll: CirclePoll) => void;
}

export function CreateCirclePollModal({ circleId, circleMembers = [], onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [dates, setDates] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validDates = dates.filter(d => d.trim());
    if (!question.trim() || validDates.length < 2) return;
    setCreating(true);
    setError('');
    try {
      const options = validDates.map(d => ({ label: formatOptionLabel(d), eventDate: localDateTimeToISO(d) }));
      const { data } = await api.post(`/circles/${circleId}/polls`, { question: question.trim(), options, excludedUserIds });
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || t('common.error'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title={t('circle.createPoll.title')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">
        {t('circle.createPoll.intro')}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('circle.createPoll.question')} value={question} onChange={e => setQuestion(e.target.value)} placeholder={t('circle.createPoll.questionPlaceholder')} required autoFocus />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">{t('circle.createPoll.dates')}</label>
          {dates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <DateTimeField
                value={d}
                onChange={v => { const next = [...dates]; next[i] = v; setDates(next); }}
                required
                openAt={dates.find(Boolean)}
                className="flex-1 min-w-0"
              />
              {dates.length > 2 && (
                <button type="button" onClick={() => setDates(dates.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 p-1">
                  <X size={15} />
                </button>
              )}
            </div>
          ))}
          {dates.length < 6 && (
            <button
              type="button"
              onClick={() => setDates([...dates, ''])}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium self-start"
            >
              <Plus size={13} />{t('circle.createPoll.addDate')}
            </button>
          )}
        </div>

        {user && (
          <SurpriseSelector
            members={circleMembers}
            currentUserId={user.id}
            value={excludedUserIds}
            onChange={setExcludedUserIds}
            label={t('circle.createPoll.surpriseLabel')}
            hint={t('circle.createPoll.surpriseHint')}
          />
        )}
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={creating}>{creating ? t('common.creating') : t('circle.createPoll.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}
