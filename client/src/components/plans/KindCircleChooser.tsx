import { ChevronRight, Link2 } from 'lucide-react';
import { Circle } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { t } from '../../i18n';

// Page /pere-noel → tableau de bord : où créer le Plan « Père Noël secret » ? Un des Cercles où la personne peut créer
// des Plans, ou le Cercle personnel « Mes Plans » (participants invités par lien).
export function KindCircleChooser({ circles, onChoose, onPersonal, onClose }: {
  circles: Circle[]; onChoose: (circleId: string) => void; onPersonal: () => void; onClose: () => void;
}) {
  return (
    <Modal title={`🎅 ${t('noel.chooseTitle')}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-3">{t('noel.chooseText')}</p>
      <div className="space-y-2">
        {circles.map(c => (
          <button key={c.id} onClick={() => onChoose(c.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-left">
            <Avatar pseudo={c.name} size="sm" noPhoto />
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">{c.name}</span>
            <ChevronRight size={16} className="text-slate-400" />
          </button>
        ))}
        <button onClick={onPersonal}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-left">
          <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><Link2 size={16} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-slate-800">{t('noel.chooseLink')}</span>
            <span className="block text-xs text-slate-500">{t('noel.chooseLinkHint')}</span>
          </span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      </div>
    </Modal>
  );
}
