import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { PersonSheet, Person, PersonActions } from '../components/ui/PersonSheet';

// Photos de profil des personnes qu'on côtoie ({ pseudo: clé }, GET /photos/people), chargées par le tableau
// de bord. Avatar s'en sert partout où il affiche quelqu'un ; openPerson ouvre la fiche d'une personne.
interface PhotosValue {
  avatarOf: (pseudo: string) => string | null;
  refresh: () => void;
  setMine: (pseudo: string, key: string | null) => void;
  openPerson: (p: Person) => void;
}

const Ctx = createContext<PhotosValue>({ avatarOf: () => null, refresh: () => {}, setMine: () => {}, openPerson: () => {} });

// `actions` (tableau de bord) : ce que la fiche d'une personne peut ouvrir (Cercle, Plan, création d'un Plan)
export function PhotosProvider({ children, actions }: { children: React.ReactNode; actions?: PersonActions }) {
  const [map, setMap] = useState<Record<string, string>>({});
  const [person, setPerson] = useState<Person | null>(null);
  const last = useRef(0);
  const refresh = useCallback(() => {
    // Au plus une fois toutes les 10 s (les rechargements du tableau de bord sont fréquents)
    if (Date.now() - last.current < 10_000) return;
    last.current = Date.now();
    api.get('/photos/people').then(r => setMap(r.data ?? {})).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const value: PhotosValue = {
    avatarOf: pseudo => map[pseudo] ?? null,
    refresh,
    setMine: (pseudo, key) => setMap(prev => { const n = { ...prev }; if (key) n[pseudo] = key; else delete n[pseudo]; return n; }),
    openPerson: setPerson,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {person && <PersonSheet person={person} photoKey={map[person.pseudo] ?? null} actions={actions} onClose={() => setPerson(null)} />}
    </Ctx.Provider>
  );
}

export const usePhotos = () => useContext(Ctx);
