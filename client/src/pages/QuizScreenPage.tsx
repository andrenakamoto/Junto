import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { LogoFull } from '../components/ui/Logo';
import { QuizStage, type QuizState, useKeyMoments } from '../components/plans/QuizTab';
import { t } from '../i18n';

// Écran de salle d'un quiz (/ecran?t=<jeton>) : à ouvrir sur l'ordinateur relié à la télévision ou au
// projecteur. Page publique, sans compte : le jeton (24 h) vient de la personne qui anime. Recharge
// chaque seconde (pas de temps réel sans compte) ; affiche ce que voit un joueur, en grand.
export function QuizScreenPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const [state, setState] = useState<QuizState | null>(null);
  const [offset, setOffset] = useState(0);
  const [expired, setExpired] = useState(false);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<QuizState>(`/quiz-screen/${encodeURIComponent(token)}`);
      setOffset(data.serverNow - Date.now());
      setState(data);
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 404) setExpired(true);
    }
  }, [token]);
  useEffect(() => {
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, [load]);
  useKeyMoments(state, offset, load);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-800 via-indigo-700 to-rose-600 text-white flex flex-col">
      <header className="flex items-center justify-between px-10 py-6">
        <LogoFull iconSize={36} />
        {state?.planTitle && <p className="text-3xl font-bold truncate ml-8">🧠 {state.planTitle}</p>}
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-10 pb-10 flex flex-col justify-center">
        {expired ? (
          <p className="text-4xl text-center font-semibold">{t('games.quiz.screenExpired')}</p>
        ) : !state ? null : state.status === 'preparation' ? (
          <div className="text-center space-y-8">
            <p className="text-7xl font-black">{t('games.quiz.screenWaiting')}</p>
            <p className="text-3xl text-indigo-100">{t('games.quiz.screenJoin', { plan: state.planTitle ?? '' })}</p>
            <p className="text-4xl font-bold">{t('games.quiz.screenPlayers', { count: state.players.length })}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {state.players.map(p => <span key={p.id} className="px-5 py-2 rounded-full bg-white/15 text-2xl">{p.name}</span>)}
            </div>
          </div>
        ) : (
          <QuizStage state={state} offset={offset} variant="screen" />
        )}
      </main>
    </div>
  );
}
