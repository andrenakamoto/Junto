import { PlanMember } from '../../types';
import { Avatar } from '../ui/Avatar';

const rsvpCfg = {
  in: { label: 'In', cls: 'bg-emerald-100 text-emerald-700' },
  maybe: { label: 'Peut-être', cls: 'bg-amber-100 text-amber-700' },
  out: { label: 'Non', cls: 'bg-slate-100 text-slate-600' },
};

const rsvpOrder: Record<string, number> = { in: 0, maybe: 1, out: 2 };

export function MembresTab({ members }: { members: PlanMember[] }) {
  const sorted = [...members].sort((a, b) => rsvpOrder[a.rsvp] - rsvpOrder[b.rsvp]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 bg-slate-50">
      <h3 className="font-semibold text-slate-800 text-sm mb-3">
        {members.length} membre{members.length > 1 ? 's' : ''}
      </h3>
      <div className="space-y-2">
        {sorted.map(m => (
          <div key={m.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Avatar pseudo={m.user.pseudo} size="sm" />
            <span className="flex-1 text-sm font-medium text-slate-800">@{m.user.pseudo}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${rsvpCfg[m.rsvp].cls}`}>
              {rsvpCfg[m.rsvp].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
