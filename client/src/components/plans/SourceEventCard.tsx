import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Megaphone, Ticket } from 'lucide-react';
import { PlanSource } from '../../types';
import { intlLocale, t } from '../../i18n';

// Plan créé avec « Y aller avec un Cercle » : la carte de l'événement d'origine (titre, date, lieu) et le bouton
// pour s'y inscrire par son lien d'invitation. Rien du Cercle de l'organisateur ni de ses participants.
export function SourceEventCard({ source }: { source: PlanSource }) {
  const navigate = useNavigate();
  if (source.gone) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm md:text-xs text-slate-600 flex gap-2">
        <Megaphone size={15} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <span>{t('plan.source.gone', { title: source.title })}</span>
      </div>
    );
  }
  const date = source.eventDate
    ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(source.eventDate))
    : null;
  return (
    <div className="mt-3 p-3.5 rounded-xl bg-indigo-50 border border-indigo-100">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600"><Megaphone size={13} />{t('plan.source.label')}</p>
      <p className="mt-1 font-semibold text-slate-900 break-words">{source.title}</p>
      <div className="mt-1 space-y-0.5 text-sm md:text-xs text-slate-600">
        {date && <p className="flex items-center gap-1.5"><Calendar size={13} className="text-indigo-400 flex-shrink-0" />{date}</p>}
        {source.location && <p className="flex items-center gap-1.5"><MapPin size={13} className="text-indigo-400 flex-shrink-0" />{source.location}</p>}
      </div>
      {source.ended ? (
        <p className="mt-2 text-sm md:text-xs text-slate-500">{t('plan.source.ended')}</p>
      ) : source.token ? (
        <>
          <button
            onClick={() => navigate(`/invitation?token=${encodeURIComponent(source.token!)}`)}
            className="mt-2.5 w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Ticket size={15} />{t('plan.source.register')}
          </button>
          <p className="mt-2 text-xs text-slate-500">{t('plan.source.notRegistered')}</p>
        </>
      ) : (
        <p className="mt-2 text-sm md:text-xs text-slate-500">{t('plan.source.closed')}</p>
      )}
    </div>
  );
}
