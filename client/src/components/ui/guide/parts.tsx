import { ReactNode } from 'react';

// Briques communes du guide d'utilisation (une version par langue : fr.tsx, de.tsx, it.tsx, en.tsx)
export type Topic = { id: string; emoji: string; title: string; summary: string; body: ReactNode };
export type Group = { title: string; topics: Topic[] };
export type GuideText = {
  title: string; subtitle: string; briefTitle: string; tocTitle: string; close: string;
  summary: { emoji: string; text: ReactNode }[]; groups: Group[];
};

export const P = ({ children }: { children: ReactNode }) => <p className="mt-1.5 first:mt-0">{children}</p>;
export const L = ({ items }: { items: ReactNode[] }) => (
  <ul className="mt-1.5 space-y-1 list-disc pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
);
