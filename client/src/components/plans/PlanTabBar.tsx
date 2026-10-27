import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { t } from '../../i18n';

// Onglets d'un Plan sur grand écran : une seule ligne, noms en entier ; quand ils ne tiennent pas tous, la barre
// défile (molette, glisser, flèches ‹ › aux bords) et l'onglet ouvert reste visible. Quand il y a de la place, les
// onglets se partagent la largeur.
export function PlanTabBar<K extends string>({ tabs, active, onSelect, hasNews }: {
  tabs: { key: K; Icon: LucideIcon; label: string }[];
  active: K | null;
  onSelect: (key: K) => void;
  hasNews: (key: K) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);
  // L'onglet ouvert (par une notification, la cloche…) est amené dans la partie visible
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  const arrow = (dir: 1 | -1) => (
    <button onClick={() => scroll(dir)} aria-label={dir < 0 ? t('plan.detail.tabsPrev') : t('plan.detail.tabsNext')}
      className={`absolute top-0 bottom-0 ${dir < 0 ? 'left-0 bg-gradient-to-r pl-1 pr-4' : 'right-0 bg-gradient-to-l pr-1 pl-4'} from-white via-white to-transparent flex items-center z-10`}>
      <span className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-indigo-600">
        {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </span>
    </button>
  );

  return (
    <div className="relative">
      {edges.left && arrow(-1)}
      <div ref={ref} role="tablist" onScroll={update}
        // Molette verticale de la souris → défilement horizontal
        onWheel={e => { if (ref.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) ref.current.scrollLeft += e.deltaY; }}
        className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ key, Icon, label }) => (
          <button key={key} role="tab" aria-selected={active === key} onClick={() => onSelect(key)}
            className={`flex-1 flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <span className="relative">
              <Icon size={15} />
              {active !== key && hasNews(key) && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white" aria-label={t('plan.detail.new')} />
              )}
            </span>
            {label}
          </button>
        ))}
      </div>
      {edges.right && arrow(1)}
    </div>
  );
}
