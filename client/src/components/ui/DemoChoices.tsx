import { ArrowRight } from 'lucide-react';
import { PLAN_KINDS, PlanKind } from '../../lib/planKinds';
import { t } from '../../i18n';

// « Que veux-tu découvrir ? » : un exemple par type de Plan (pages/DemoPage.tsx, fenêtre de AuthPage). Chaque tuile ouvre
// la démo resserrée sur cet exemple (/demo?voir=…, clés de DEMO_SHOWCASE dans public/demo/data.json) ; « Tout voir » ouvre
// la démo complète. Liens classiques : la démo démarre sur une page rechargée.
export const DEMO_CHOICES = ['amis', 'surprise', 'pere-noel', 'jeux', 'voyage', 'cours', 'annonce', 'organisation', 'assemblee'] as const;
export type DemoChoice = typeof DEMO_CHOICES[number];

const kindOf = (c: DemoChoice): PlanKind | null => c === 'amis' ? null : c === 'pere-noel' ? 'pere_noel' : c;

export function DemoChoices() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {DEMO_CHOICES.map(c => {
          const kind = kindOf(c);
          const emoji = kind ? PLAN_KINDS.find(k => k.kind === kind)?.emoji : '🍻';
          return (
            <a key={c} href={`/demo?voir=${c}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors text-left">
              <span aria-hidden className="text-2xl w-8 text-center flex-shrink-0">{emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{kind ? t(`plan.kinds.${kind}.name`) : t('auth.demoChooser.amis')}</span>
                <span className="block text-xs text-slate-500 leading-snug">{kind ? t(`plan.kinds.${kind}.hint`) : t('auth.demoChooser.amisHint')}</span>
              </span>
            </a>
          );
        })}
      </div>
      <a href="/demo?voir=tout" className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
        {t('auth.demoChooser.all')} <ArrowRight size={15} />
      </a>
    </div>
  );
}
