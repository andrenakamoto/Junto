import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import api from '../../services/api';
import { CirclePoll } from '../../types';

function localDateTimeToISO(str: string): string {
  const [datePart, timePart] = str.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).toISOString();
}

function formatOptionLabel(localDateTime: string): string {
  const iso = localDateTimeToISO(localDateTime);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

interface Props {
  circleId: string;
  onClose: () => void;
  onCreated: (poll: CirclePoll) => void;
}

export function CreateCirclePollModal({ circleId, onClose, onCreated }: Props) {
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
      const { data } = await api.post(`/circles/${circleId}/polls`, { question: question.trim(), options });
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Proposer plusieurs dates" onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">
        Chaque membre coche les dates qui lui conviennent. Une fois la meilleure date trouvée, tu pourras créer le Plan directement dessus.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="On se voit quand pour le resto ?" required autoFocus />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Dates proposées</label>
          {dates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="datetime-local"
                value={d}
                onChange={e => { const next = [...dates]; next[i] = e.target.value; setDates(next); }}
                required
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white text-sm"
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
              <Plus size={13} />Ajouter une date
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={creating}>{creating ? 'Création...' : 'Créer le sondage'}</Button>
        </div>
      </form>
    </Modal>
  );
}
