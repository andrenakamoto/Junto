import { useEffect } from 'react';
import { startDemo } from '../lib/demo';
import { countStep } from '../lib/funnel';

// /demo : lance la démo sans compte (lib/demo.ts), puis ouvre le tableau de bord d'Alex.
// Rechargement complet pour que la session et le client API passent en mode démo.
export function DemoPage() {
  useEffect(() => {
    countStep('funnel_demo');
    startDemo();
    window.location.replace('/dashboard');
  }, []);
  return null;
}
