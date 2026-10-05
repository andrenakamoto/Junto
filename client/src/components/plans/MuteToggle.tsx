import { Bell, BellOff } from 'lucide-react';
import { useMutes } from '../../contexts/MuteContext';

// Cloche « mode silencieux » d'un Plan (carte du Plan, en-tête de la fiche). Dans une carte
// (elle-même un bouton) : élément « role=button » pour ne pas imbriquer deux boutons.
export function MuteToggle({ plan, size = 15, showWhenOn = true }: {
  plan: { id: string; title: string; circleId?: string | null };
  size?: number;
  /** Faux : n'afficher que l'état « en silence » (rien quand les notifications sont actives) */
  showWhenOn?: boolean;
}) {
  const { isPlanMuted, isCircleMuted, setPlanMuted } = useMutes();
  const planMuted = isPlanMuted(plan.id);
  const circleMuted = isCircleMuted(plan.circleId);
  const muted = planMuted || circleMuted;
  if (!muted && !showWhenOn) return null;

  function toggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (circleMuted && !planMuted) {
      alert('Tout le Cercle est en silence. Réactive ses notifications avec la cloche en haut de la liste des Plans.');
      return;
    }
    setPlanMuted(plan, !planMuted);
  }

  const title = muted
    ? (circleMuted && !planMuted ? 'Cercle en silence' : 'En silence — toucher pour réactiver les notifications')
    : 'Mettre ce Plan en silence (plus de notifications ni d’emails)';
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      aria-pressed={muted}
      onClick={toggle}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggle(e); }}
      className={`flex-shrink-0 p-1 rounded-full transition-colors cursor-pointer ${muted ? 'text-slate-500 bg-slate-100 hover:bg-slate-200' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
    >
      {muted ? <BellOff size={size} /> : <Bell size={size} />}
    </span>
  );
}
