import { ReactNode } from 'react';
import { siteUrl } from '../../../lib/siteUrl';

// Briques communes des conditions d'utilisation (une version par langue : fr.tsx, de.tsx, it.tsx, en.tsx)
export type TermsSection = { title: string; body: ReactNode };
export type TermsText = {
  title: string; version: string; news: string; sections: TermsSection[];
  confirm: string; scroll: string; accept: string; accepting: string; close: string; translationNote?: string;
};

export const P = ({ children }: { children: ReactNode }) => <p className="mt-2 first:mt-0">{children}</p>;
export const Rules = ({ items }: { items: string[] }) => (
  <ul className="mt-2 space-y-1.5 list-none">
    {items.map((rule, i) => (
      <li key={i} className="flex items-start gap-2">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
        {rule}
      </li>
    ))}
  </ul>
);
export const Mail = () => <strong>info@evly.ch</strong>;

export const PrivacyLink = ({ children }: { children: ReactNode }) => (
  <a href={siteUrl('/confidentialite')} target="_blank" rel="noopener" className="text-indigo-600 underline">{children}</a>
);
