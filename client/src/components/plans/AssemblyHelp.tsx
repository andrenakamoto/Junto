import { ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { currentLang, type Lang } from '../../i18n';
import type { AssemblyHelpStep, AssemblyHelpText } from './assemblyHelp/types';
import fr from './assemblyHelp/fr';
import de from './assemblyHelp/de';
import it from './assemblyHelp/it';
import en from './assemblyHelp/en';

// Aide de l'onglet Assemblée (bouton « Aide ») : comment gérer une assemblée, des réglages et de l'ordre du jour à la
// clôture et au procès-verbal, avec les cas particuliers (procurations, vote sans téléphone). Une version par langue
// (assemblyHelp/*.tsx), à tenir à jour avec l'assemblée.
const TEXTS: Record<Lang, AssemblyHelpText> = { fr, de, it, en };

function Step({ step }: { step: AssemblyHelpStep }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none flex items-center gap-3 px-4 py-3 font-semibold text-slate-900">
        <span aria-hidden className="text-lg">{step.emoji}</span>
        <span className="flex-1">{step.title}</span>
        <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-sm text-slate-700 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_b]:font-semibold [&_b]:text-slate-900">
        {step.body}
      </div>
    </details>
  );
}

export function AssemblyHelp({ onClose }: { onClose: () => void }) {
  const T = TEXTS[currentLang()] ?? fr;
  return (
    <Modal wide title={T.title} onClose={onClose}>
      <p className="text-sm text-slate-600">{T.intro}</p>
      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{T.forOrganizers}</p>
      <div className="space-y-2">{T.steps.map(s => <Step key={s.id} step={s} />)}</div>
      <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">{T.forMembers}</p>
      <Step step={T.members} />
    </Modal>
  );
}
