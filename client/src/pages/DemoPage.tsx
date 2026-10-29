import { useEffect, useState } from 'react';
import { startDemo } from '../lib/demo';
import { countStep } from '../lib/funnel';
import { DEMO_CHOICES, DemoChoices } from '../components/ui/DemoChoices';
import { LogoIcon } from '../components/ui/Logo';
import { LanguagePicker } from '../components/ui/LanguagePicker';
import { t } from '../i18n';

// /demo : démo sans compte (lib/demo.ts). Sans ?voir : « Que veux-tu découvrir ? » (un exemple par type de Plan).
// ?voir=<exemple> (amis, pere-noel, organisation…) : démo resserrée sur ce Plan, ouverte sur sa rubrique (DEMO_SHOWCASE de
// public/demo/data.json : [identifiant du Plan, rubrique]) ; ?voir=tout : démo complète. Rechargement complet pour que la
// session et le client API passent en mode démo.

async function showcasePath(key: string): Promise<string> {
  try {
    const { fixtures } = await (await fetch('/demo/data.json')).json() as { fixtures: Record<string, any> };
    const sc = (fixtures.DEMO_SHOWCASE as Record<string, [string, string]> | undefined)?.[key];
    return sc ? `/dashboard?planId=${sc[0]}&tab=${sc[1]}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

// Une seule fois par chargement : une seconde redirection (effet relancé) couperait le chargement de la démo
let started = false;

export function DemoPage() {
  const voir = new URLSearchParams(window.location.search).get('voir');
  const known = voir === 'tout' || (DEMO_CHOICES as readonly string[]).includes(voir ?? '');
  const [choosing] = useState(!known);

  useEffect(() => {
    if (!known || started) return;
    started = true;
    countStep('funnel_demo');
    if (voir === 'tout') { startDemo(); window.location.replace('/dashboard'); return; }
    startDemo(voir!);
    showcasePath(voir!).then(path => window.location.replace(path));
  }, []);

  if (!choosing) return null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-3 right-3 text-slate-300" style={{ marginTop: 'var(--sa-top, 0px)' }}>
        <LanguagePicker compact />
      </div>
      <div className="w-full max-w-2xl py-10">
        <div className="flex justify-center mb-6"><a href="/auth"><LogoIcon size={48} /></a></div>
        <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-2xl">
          <h1 className="text-xl font-bold text-slate-900">{t('auth.demoChooser.title')}</h1>
          <p className="text-sm text-slate-500 mt-1 mb-4">{t('auth.demoChooser.sub')}</p>
          <DemoChoices />
        </div>
      </div>
    </div>
  );
}
