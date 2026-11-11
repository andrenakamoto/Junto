import { useEffect, useState } from 'react';
import api from '../services/api';

// Noms de famille que la personne peut voir (GET /circles/:id/last-names ou /plans/:id/last-names) : ceux qui ont choisi de les
// montrer, et tous pour les responsables d'une Organisation. Jamais ailleurs dans les réponses de l'API.
export function useLastNames(url: string | null, reloadKey?: unknown): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!url) { setNames({}); return; }
    let live = true;
    api.get(url).then(r => { if (live) setNames(r.data ?? {}); }).catch(() => { if (live) setNames({}); });
    return () => { live = false; };
  }, [url, reloadKey]);
  return names;
}

// « Prénom Nom », ou le prénom seul
export function withLastName(first: string | null, last?: string | null): string | null {
  return first ? (last ? `${first} ${last}` : first) : null;
}
