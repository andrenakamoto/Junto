import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { CreatePlanModal } from './CreatePlanModal';
import api from '../../services/api';
import { Circle, Plan } from '../../types';
import { isCircleManager } from '../../lib/settings';
import { useAuth } from '../../contexts/AuthContext';
import { t } from '../../i18n';

// « Y aller avec un Cercle » : depuis un événement en Mode annonce, choisir un de ses Cercles puis créer un Plan
// pré-rempli (titre, dates, lieu) pour y aller avec ses amis. Les Cercles qui voient déjà l'événement et ceux où
// la création des Plans est réservée sont écartés (le serveur vérifie aussi).
export function GoWithCircleModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [chosen, setChosen] = useState<Circle | null>(null);

  useEffect(() => {
    const seen = new Set([plan.circleId, ...(plan.circles ?? []).map(c => c.id)]);
    api.get<Circle[]>('/circles')
      .then(res => setCircles(res.data.filter(c => !seen.has(c.id) && (c.planCreationMode !== 'creator' || isCircleManager(c, user?.id)))))
      .catch(() => setCircles([]));
  }, [plan.id]);

  if (chosen) {
    return (
      <CreatePlanModal
        circleId={chosen.id}
        circleMembers={chosen.members}
        fromEvent={{ sourcePlanId: plan.id, title: plan.title, eventDate: plan.eventDate, endDate: plan.endDate, location: plan.location }}
        onClose={() => setChosen(null)}
        onCreated={created => { onClose(); navigate(`/dashboard?planId=${created.id}`); }}
      />
    );
  }

  return (
    <Modal title={t('plan.goWith.title')} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">{t('plan.goWith.intro')}</p>
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
