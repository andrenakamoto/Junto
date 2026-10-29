import { useEffect } from 'react';
import { startDemo } from '../lib/demo';
import { countStep } from '../lib/funnel';

// /demo : lance la démo sans compte (lib/demo.ts), puis ouvre le tableau de bord d'Alex.
// Rechargement complet pour que la session et le client API passent en mode démo.
// /demo?voir=pere-noel (page /pere-noel) : ouvre directement un Plan de la démo sur sa rubrique, trouvé dans les
// données de la démo (public/demo/data.json) d'après la fonction activée, pour survivre à une régénération.
const SHOWCASE: Record<string, { feature: string; prefer: string }> = {
  'pere-noel': { feature: 'pere_noel', prefer: 'copains' },
};

async function showcasePath(key: string | null): Promise<string> {
  const target = key ? SHOWCASE[key] : undefined;
  if (!target) return '/dashboard';
  try {
    const { fixtures } = await (await fetch('/demo/data.json')).json() as { fixtures: Record<string, any> };
    const plans = Object.entries(fixtures)
      .filter(([k, v]) => /^GET \/plans\/[^/]+$/.test(k) && v?.enabledFeatures?.includes(target.feature))
      .map(([, v]) => v as { id: string; title: string });
    const plan = plans.find(p => p.title.toLowerCase().includes(target.prefer)) ?? plans[0];
    return plan ? `/dashboard?planId=${plan.id}&tab=${target.feature}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export function DemoPage() {
  useEffect(() => {
    countStep('funnel_demo');
    startDemo();
    showcasePath(new URLSearchParams(window.location.search).get('voir')).then(path => window.location.replace(path));
  }, []);
  return null;
}
