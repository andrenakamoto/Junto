import { useEffect } from 'react';
import { startDemo } from '../lib/demo';
import { countStep } from '../lib/funnel';

// /demo : lance la démo sans compte (lib/demo.ts), puis ouvre le tableau de bord d'Alex.
// Rechargement complet pour que la session et le client API passent en mode démo.
// /demo?voir=pere-noel (page /pere-noel) : démo resserrée (un Cercle, un Plan, lib/demo.ts focusOnSanta), ouverte sur la rubrique du Plan, trouvé dans les
// données de la démo (public/demo/data.json) d'après la fonction activée, pour survivre à une régénération.
// `circle` : code du Cercle de la démo où chercher d'abord (le même que lib/demo.ts focusOnSanta)
const SHOWCASE: Record<string, { feature: string; circle: string }> = {
  'pere-noel': { feature: 'pere_noel', circle: 'DEMO6X' },
};

async function showcasePath(key: string | null): Promise<string> {
  const target = key ? SHOWCASE[key] : undefined;
  if (!target) return '/dashboard';
  try {
    const { fixtures } = await (await fetch('/demo/data.json')).json() as { fixtures: Record<string, any> };
    const plans = Object.entries(fixtures)
      .filter(([k, v]) => /^GET \/plans\/[^/]+$/.test(k) && v?.enabledFeatures?.includes(target.feature))
      .map(([, v]) => v as { id: string; circleId: string });
    const circleId = (fixtures['GET /circles'] as { id: string; code: string }[]).find(c => c.code === target.circle)?.id;
    const plan = plans.find(p => p.circleId === circleId) ?? plans[0];
    return plan ? `/dashboard?planId=${plan.id}&tab=${target.feature}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

// Une seule fois par chargement : une seconde redirection (effet relancé) couperait le chargement de la démo
let started = false;

export function DemoPage() {
  useEffect(() => {
    if (started) return;
    started = true;
    countStep('funnel_demo');
    const voir = new URLSearchParams(window.location.search).get('voir');
    startDemo(voir === 'pere-noel' ? 'pere-noel' : undefined);
    showcasePath(voir).then(path => window.location.replace(path));
  }, []);
  return null;
}
