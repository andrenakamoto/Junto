import { Calendar, MapPin, MessageSquare, Users, Repeat } from 'lucide-react';
import { MuteToggle } from './MuteToggle';
import { Plan } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isPlanFull, occupiedPlaces, placesLeft as placesLeftOf, waitlistPosition } from '../../lib/places';
import { t } from '../../i18n';
import { shortDateTime } from '../../lib/dates';

interface Props {
  plan: Plan;
  isSelected: boolean;
  isUnread?: boolean;
  onClick: () => void;
}

const rsvpBadge = {
  in: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  maybe: 'bg-amber-50 text-amber-700 border-amber-200',
  out: 'bg-slate-100 text-slate-500 border-slate-200',
};
const rsvpLabel = (r: 'in' | 'maybe' | 'out') => t(`common.rsvp.${r}`);

export function PlanCard({ plan, isSelected, isUnread = false, onClick }: Props) {
  const { user } = useAuth();
  const myMember = plan.members.find(m => m.userId === user?.id);
  const inCount = plan.members.filter(m => m.rsvp === 'in').length;
  const maybeCount = plan.members.filter(m => m.rsvp === 'maybe').length;
  // Limite de places : même calcul que le serveur (« Je suis in » et « Peut-être », lib/places.ts)
  const max = plan.maxParticipants ?? null;
  const isFull = isPlanFull(plan);
  const placesLeft = placesLeftOf(plan);
  const occupied = occupiedPlaces(plan);
  const myWaitPos = waitlistPosition(plan, user?.id);
  const waiting = plan.waitlist?.length ?? 0;

  const date = plan.eventDate
    ? shortDateTime(plan.eventDate)
    : null;


  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl transition-all border relative ${
        isSelected
          ? 'bg-indigo-50 border-indigo-400 shadow-md shadow-indigo-500/10'
          : isUnread
          ? 'bg-white border-orange-300 shadow-sm hover:shadow'
          : 'bg-white border-slate-200 shadow-sm hover:border-slate-300 hover:shadow'
      }`}
    >
      {(isUnread || (plan.unseen?.length ?? 0) > 0) && !isSelected && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-orange-500 rounded-full" />
      )}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-semibold text-slate-900 text-sm leading-tight">{plan.title}</h3>
        <span className="flex-shrink-0 flex items-center gap-1">
        <MuteToggle plan={plan} />
        {myMember ? (
          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${rsvpBadge[myMember.rsvp]}`}>
            {rsvpLabel(myMember.rsvp)}
          </span>
        ) : myWaitPos ? (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {t('plan.card.waitlistPos', { n: myWaitPos })}
          </span>
        ) : isFull ? (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 border border-red-500/30">
            {t('common.full')}
          </span>
        ) : (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-600 border border-indigo-500/30">
            {t('common.join')}
          </span>
        )}
        </span>
      </div>

      {plan.description && <p className="text-slate-500 text-xs line-clamp-3 whitespace-pre-line break-words mb-2.5">{plan.description}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {date && <span className="flex items-center gap-1"><Calendar size={10} />{date}{plan.recurrence && <Repeat size={10} className="ml-0.5 text-slate-400" aria-label={t('plan.card.repeats')} />}</span>}
        {myMember && plan.location && <span className="flex items-center gap-1 truncate max-w-full"><MapPin size={10} />{plan.location}</span>}
        {myMember && (
          <span className="flex items-center gap-1">
            <Users size={10} />
            <span className="text-emerald-600">{t('common.inCount', { count: inCount })}</span>
            {maybeCount > 0 && <span className="text-amber-600">· {maybeCount} ?</span>}
          </span>
        )}
        {max != null && (
          isFull ? (
            myMember ? (
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold">{t('plan.card.fullCount', { occupied, max })}{waiting > 0 ? t('plan.card.waiting', { count: waiting }) : ''}</span>
            ) : (
              <span className="text-red-600 font-medium">{t('plan.card.places', { occupied, max })}{waiting > 0 ? t('plan.card.waiting', { count: waiting }) : ''}</span>
            )
          ) : (
            <span className={placesLeft === 1 ? 'text-amber-600 font-medium' : ''}>
              {t('plan.card.placesLeft', { count: placesLeft! })}
            </span>
          )
        )}
        {myMember && (plan._count?.messages ?? 0) > 0 && (
          <span className="flex items-center gap-1"><MessageSquare size={10} />{plan._count!.messages}</span>
        )}
      </div>
    </button>
  );
}
