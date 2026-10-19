import { useEffect, useState } from 'react';

// Tri des listes de Plans (liste d'un Cercle, « Tous mes plans ») : par dernière activité ou par date de début.
// Choix mémorisé sur l'appareil (localStorage), le même pour toutes les listes.
export type PlanSort = 'activity' | 'date';
function read(key: string, fallback: PlanSort): PlanSort {
  try { const v = localStorage.getItem(key); return v === 'activity' || v === 'date' ? v : fallback; } catch { return fallback; }
}

function useStoredSort(key: string, fallback: PlanSort): [PlanSort, (s: PlanSort) => void] {
  const event = `${key}-changed`;
  const [sort, setSort] = useState<PlanSort>(() => read(key, fallback));
  useEffect(() => {
    const sync = () => setSort(read(key, fallback));
    window.addEventListener(event, sync);
    return () => window.removeEventListener(event, sync);
  }, [key, fallback]);
  return [sort, (s: PlanSort) => {
    try { localStorage.setItem(key, s); } catch { /* stockage indisponible : choix gardé le temps de la session */ }
    setSort(s);
    window.dispatchEvent(new Event(event));
  }];
}

export const usePlanSort = (fallback: PlanSort) => useStoredSort('evly_plan_sort', fallback);

// Liste des Cercles : « Activité » ou « Date » (prochain événement du Cercle), choix séparé de celui des Plans
export const useCircleSort = () => useStoredSort('evly_circle_sort', 'activity');
