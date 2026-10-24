import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { CreatePlanModal } from '../plans/CreatePlanModal';
import api from '../../services/api';
import { Circle } from '../../types';
import { isCircleManager } from '../../lib/settings';
import { useAuth } from '../../contexts/AuthContext';
import { DiscoverEvent } from '../../lib/discover';
import { t } from '../../i18n';

// « Y aller avec un Cercle » depuis Découvrir : choisir un Cercle, puis la fenêtre « Créer un Plan » pré-remplie
// (titre, dates, lieu, lien « Plus d'infos » dans la description)
export function DiscoverGoModal({ event, onClose }: { event: DiscoverEvent; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [chosen, setChosen] = useState<Circle | null>(null);

  useEffect(() => {
    api.get<Circle[]>('/circles')
      .then(res => setCircles(res.data.filter(c => c.planCreationMode !== 'creator' || isCircleManager(c, user?.id))))
      .catch(() => setCircles([]));
  }, []);

  if (chosen) {
    // Événement sur plusieurs jours (exposition, festival…) : une sortie de 3 heures à ajuster, pas toute la durée,
    // et aujourd'hui plutôt que le premier jour s'il a déjà commencé
    const multi = event.multiDay || (!!event.endAt && new Date(event.endAt).toDateString() !== new Date(event.startAt).toDateString());
    const start = multi ? outingStart(event.startAt) : new Date(event.startAt);
    const end = multi || !event.endAt ? new Date(start.getTime() + 3 * 3600e3).toISOString() : event.endAt;
    return (
      <CreatePlanModal
        circleId={chosen.id}
        circleMembers={chosen.members}
        fromEvent={{ title: event.title, eventDate: start.toISOString(), endDate: end, location: [event.place, event.city].filter(Boolean).join(', ') || null, url: event.url }}
        onClose={() => setChosen(null)}
        onCreated={created => { onClose(); navigate(`/dashboard?planId=${created.id}`); }}
      />
    );
  }

  return (
    <Modal title={t('plan.goWith.title')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-2">{event.title}</p>
      <p className="text-xs text-slate-500 mb-4">{t('discover.checkBefore')}</p>
      {circles === null ? (
        <p className="text-sm text-slate-400">…</p>
      ) : circles.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-3">{t('plan.goWith.none')}</p>
      ) : (
        <div className="space-y-2">
          {circles.map(c => (
            <button key={c.id} onClick={() => setChosen(c)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-colors">
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: c.color ?? '#94a3b8' }}>{c.name[0]?.toUpperCase()}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-slate-800 truncate">{c.name}</span>
                <span className="block text-xs text-slate-400">{t('circle.joinPage.members', { count: c.members.length }).replace(/^\s*·\s*/, '')}</span>
              </span>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

// Aujourd'hui à l'heure de début de l'événement (heure suivante si elle est passée), jamais avant son premier jour
function outingStart(startAt: string): Date {
  const first = new Date(startAt);
  const now = new Date();
  const today = new Date(now);
  today.setHours(first.getHours(), first.getMinutes(), 0, 0);
  if (today < now) today.setTime(Math.ceil(now.getTime() / 3600e3) * 3600e3);
  return today > first ? today : first;
}
