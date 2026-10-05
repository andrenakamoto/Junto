import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../services/api';

// Mode silencieux (serveur : lib/mutes.ts) : plus de push, d'email ni de bulle pour un Plan ou un
// Cercle ; les points orange restent. Chargé une fois par le tableau de bord.
type Named = { id: string; title?: string; name?: string };
interface MuteState {
  mutedPlans: Named[];
  mutedCircles: Named[];
  isPlanMuted: (planId: string) => boolean;
  isCircleMuted: (circleId: string | null | undefined) => boolean;
  setPlanMuted: (plan: { id: string; title: string }, muted: boolean) => Promise<void>;
  setCircleMuted: (circle: { id: string; name: string }, muted: boolean) => Promise<void>;
}

const MuteContext = createContext<MuteState | null>(null);

export function MuteProvider({ children }: { children: ReactNode }) {
  const [mutedPlans, setMutedPlans] = useState<Named[]>([]);
  const [mutedCircles, setMutedCircles] = useState<Named[]>([]);

  useEffect(() => {
    api.get('/mutes').then(({ data }) => { setMutedPlans(data.plans ?? []); setMutedCircles(data.circles ?? []); }).catch(() => {});
  }, []);

  const isPlanMuted = useCallback((id: string) => mutedPlans.some(p => p.id === id), [mutedPlans]);
  const isCircleMuted = useCallback((id: string | null | undefined) => !!id && mutedCircles.some(c => c.id === id), [mutedCircles]);

  // Changement affiché tout de suite, annulé si le serveur refuse
  async function setPlanMuted(plan: { id: string; title: string }, muted: boolean) {
    const before = mutedPlans;
    setMutedPlans(muted ? [{ id: plan.id, title: plan.title }, ...before.filter(p => p.id !== plan.id)] : before.filter(p => p.id !== plan.id));
    try { await api.put('/mutes', { planId: plan.id, muted }); }
    catch (err: any) { setMutedPlans(before); alert(err.response?.data?.error || 'Erreur, réessaie dans un instant'); }
  }
  async function setCircleMuted(circle: { id: string; name: string }, muted: boolean) {
    const before = mutedCircles;
    setMutedCircles(muted ? [{ id: circle.id, name: circle.name }, ...before.filter(c => c.id !== circle.id)] : before.filter(c => c.id !== circle.id));
    try { await api.put('/mutes', { circleId: circle.id, muted }); }
    catch (err: any) { setMutedCircles(before); alert(err.response?.data?.error || 'Erreur, réessaie dans un instant'); }
  }

  return (
    <MuteContext.Provider value={{ mutedPlans, mutedCircles, isPlanMuted, isCircleMuted, setPlanMuted, setCircleMuted }}>
      {children}
    </MuteContext.Provider>
  );
}

// Hors du tableau de bord (ou avant chargement) : rien n'est en silence, les réglages sont sans effet
const noop: MuteState = {
  mutedPlans: [], mutedCircles: [], isPlanMuted: () => false, isCircleMuted: () => false,
  setPlanMuted: async () => {}, setCircleMuted: async () => {},
};
export function useMutes(): MuteState {
  return useContext(MuteContext) ?? noop;
}
