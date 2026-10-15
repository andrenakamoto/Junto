import { useEffect, useState } from 'react';

// Tri des listes de Plans (liste d'un Cercle, « Tous mes plans ») : par dernière activité ou par date de début.
// Choix mémorisé sur l'appareil (localStorage), le même pour toutes les listes.
export type PlanSort = 'activity' | 'date';
const KEY = 'evly_plan_sort';
const EVENT = 'evly-plan-sort';

function read(fallback: PlanSort): PlanSort {
  try { const v = localStorage.getItem(KEY); return v === 'activity' || v === 'date' ? v : fallback; } catch { return fallback; }
}

export function usePlanSort(fallback: PlanSort): [PlanSort, (s: PlanSort) => void] {
  const [sort, setSort] = useState<PlanSort>(() => read(fallback));
  useEffect(() => {
    const sync = () => setSort(read(fallback));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [fallback]);
  return [sort, (s: PlanSort) => {
    try { localStorage.setItem(KEY, s); } catch { /* stockage indisponible : choix gardé le temps de la session */ }
    setSort(s);
    window.dispatchEvent(new Event(EVENT));
  }];
}
