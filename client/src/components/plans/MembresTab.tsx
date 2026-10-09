import { Plan, PlanMember } from '../../types';
import { Avatar } from '../ui/Avatar';
import { displayName } from '../../lib/names';

const rsvpCfg = {
  in: { label: 'In', cls: 'bg-emerald-100 text-emerald-700' },
  maybe: { label: 'Peut-être', cls: 'bg-amber-100 text-amber-700' },
  out: { label: 'Non', cls: 'bg-slate-100 text-slate-600' },
};

const rsvpOrder: Record<string, number> = { in: 0, maybe: 1, out: 2 };

export function MembresTab({ members, onlineUserIds, waitlist = [] }: { members: PlanMember[]; onlineUserIds?: Set<string>; waitlist?: NonNullable<Plan['waitlist']> }) {
  const sorted = [...members].sort((a, b) => rsvpOrder[a.rsvp] - rsvpOrder[b.rsvp]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50 short:flex-none short:overflow-visible">
      <h3 className="font-semibold text-slate-800 text-sm mb-3">
        {members.length} membre{members.length > 1 ? 's' : ''}
      </h3>
      <div className="space-y-2">
        {sorted.map(m => (
          <div key={m.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Avatar pseudo={m.user.pseudo} size="sm" online={onlineUserIds ? onlineUserIds.has(m.userId) : undefined} />
            <span className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-800">{displayName(m.user) ?? `@${m.user.pseudo}`}</span>
              {m.isGuest && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 align-middle">
                  Invité(e)
                </span>
              )}
              {displayName(m.user) && <span className="block text-xs text-slate-400 truncate">@{m.user.pseudo}</span>}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rsvpCfg[m.rsvp].cls}`}>
              {rsvpCfg[m.rsvp].label}
            </span>
          </div>
        ))}
      </div>
      {waitlist.length > 0 && (
        <>
          <h3 className="font-semibold text-slate-800 text-sm mt-5 mb-1">Liste d’attente</h3>
          <p className="text-xs text-slate-400 mb-3">Dès qu’une place se libère, la première personne est inscrite automatiquement.</p>
          <div className="space-y-2">
            {waitlist.map((w, i) => (
              <div key={w.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-dashed border-amber-300">
                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700">{w.user ? displayName(w.user) ?? `@${w.user.pseudo}` : 'Membre'}</span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">En attente</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
