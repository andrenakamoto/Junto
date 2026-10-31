import type { ReactNode } from 'react';

// Aide de l'onglet Assemblée : une version par langue (fr.tsx, de.tsx, it.tsx, en.tsx)
export type AssemblyHelpStep = { id: string; emoji: string; title: string; body: ReactNode };
export type AssemblyHelpText = {
  title: string; intro: string; forOrganizers: string; forMembers: string;
  steps: AssemblyHelpStep[]; members: AssemblyHelpStep;
};
