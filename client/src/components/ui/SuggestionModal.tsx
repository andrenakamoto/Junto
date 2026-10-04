import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Modal } from './Modal';
import { Button } from './Button';
import api from '../../services/api';
import { kindLabel, statusOf, Suggestion, SuggestionKind, SUGGESTION_KINDS, SUGGESTION_MAX } from '../../lib/suggestions';

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short' });

// Appareil et version, pour aider à reproduire un problème
async function deviceInfo(): Promise<{ platform: string; appVersion?: string }> {
  const platform = Capacitor.getPlatform();
  if (!Capacitor.isNativePlatform()) return { platform: 'web' };
  try {
    const info = await CapApp.getInfo();
    return { platform, appVersion: `${info.version} (${info.build})` };
  } catch {
    return { platform };
  }
}

// « Proposer une amélioration » (menu ☰) : envoi d'une idée, d'un problème ou d'autre chose,
// et suivi de ses suggestions (statut et réponse de l'équipe)
export function SuggestionModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<SuggestionKind>('idea');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<Suggestion[] | null>(null);

  const loadMine = () => api.get<Suggestion[]>('/suggestions/mine').then(res => setMine(res.data)).catch(() => setMine([]));
  useEffect(() => { loadMine(); }, []);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/suggestions', { kind, content, ...(await deviceInfo()) });
      setContent('');
      setSent(true);
      loadMine();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Envoi impossible, réessaie plus tard');
    } finally {
      setSending(false);
    }
  }

  const placeholder = SUGGESTION_KINDS.find(k => k.value === kind)!.placeholder;

  return (
    <Modal title="Proposer une amélioration" onClose={onClose}>
      <div className="space-y-4">
        {sent ? (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-3">
            Merci ! Ta suggestion est bien arrivée. Tu seras prévenu(e) quand elle sera prévue ou réalisée.
            <button onClick={() => setSent(false)} className="block mt-2 text-emerald-700 font-medium underline underline-offset-2">Envoyer une autre suggestion</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">Une idée, un problème, une remarque ? Chaque message est lu.</p>
            <div className="flex gap-2">
              {SUGGESTION_KINDS.map(k => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`flex-1 px-2 py-2 rounded-lg border text-sm ${kind === k.value ? 'border-indigo-300 bg-indigo-50 text-indigo-800 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value.slice(0, SUGGESTION_MAX))}
                placeholder={placeholder}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white resize-none text-sm"
              />
              <p className="text-xs text-slate-400 text-right">{content.length}/{SUGGESTION_MAX}</p>
            </div>
            {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={onClose}>Fermer</Button>
              <Button onClick={send} disabled={sending || !content.trim()}>{sending ? 'Envoi…' : 'Envoyer'}</Button>
            </div>
          </>
        )}

        {mine && mine.length > 0 && (
          <section className="pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Mes suggestions</h3>
            <div className="space-y-2">
              {mine.map(s => {
                const st = statusOf(s.status);
                return (
                  <div key={s.id} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span>{kindLabel(s.kind)}</span>
                      <span>· {dateFmt.format(new Date(s.createdAt))}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${st.className}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line break-words line-clamp-4">{s.content}</p>
                    {s.reply && (
                      <p className="mt-2 text-sm text-slate-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-indigo-800">Réponse d’EvLY : </span>{s.reply}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
