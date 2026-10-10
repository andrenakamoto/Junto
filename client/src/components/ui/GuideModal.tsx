import { useRef, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { Button } from './Button';
import { currentLang, type Lang } from '../../i18n';
import type { GuideText } from './guide/parts';
import fr from './guide/fr';
import de from './guide/de';
import it from './guide/it';
import en from './guide/en';

interface Props {
  onClose: () => void;
}

// Guide d'utilisation (menu ☰ → « Guide d'utilisation ») : une synthèse « EvLY en bref », un sommaire, puis une
// fiche dépliable par fonctionnalité, rangées par thème. Une version par langue (guide/*.tsx), à tenir à jour
// dans les 4 langues à chaque nouvelle fonction.
const TEXTS: Record<Lang, GuideText> = { fr, de, it, en };

export function GuideModal({ onClose }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const T = TEXTS[currentLang()] ?? fr;
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  function goTo(id: string) {
    setOpen(prev => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{T.title}</h2>
          </div>
          <p className="text-sm text-slate-500">{T.subtitle}</p>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5 text-sm text-slate-700 leading-relaxed">
          {/* Synthèse */}
          <section className="rounded-xl bg-indigo-50 p-4">
            <h3 className="font-bold text-slate-900 mb-2">{T.briefTitle}</h3>
            <ul className="space-y-1.5">
              {T.summary.map((s, i) => (
                <li key={i} className="flex gap-2"><span className="flex-shrink-0">{s.emoji}</span><span>{s.text}</span></li>
              ))}
            </ul>
          </section>

          {/* Sommaire */}
          <section className="mt-5">
            <h3 className="font-bold text-slate-900 mb-2">{T.tocTitle}</h3>
            <div className="space-y-3">
              {T.groups.map(g => (
                <div key={g.title}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{g.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.topics.map(t => (
                      <button key={t.id} onClick={() => goTo(t.id)} className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-xs text-slate-700">
                        {t.emoji} {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Détail de chaque fonction */}
          {T.groups.map(g => (
            <section key={g.title} className="mt-6">
              <h3 className="font-bold text-slate-900 mb-2">{g.title}</h3>
              <div className="space-y-2">
                {g.topics.map(t => {
                  const isOpen = open.has(t.id);
                  return (
                    <div key={t.id} id={`guide-${t.id}`} className="rounded-xl border border-slate-200 scroll-mt-2">
                      <button onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left" aria-expanded={isOpen}>
                        <span className="text-lg flex-shrink-0">{t.emoji}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-slate-900">{t.title}</span>
                          <span className="block text-xs text-slate-500">{t.summary}</span>
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && <div className="px-3 pb-3 pt-0.5 border-t border-slate-100">{t.body}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <Button onClick={onClose} className="w-full">{T.close}</Button>
        </div>
      </div>
    </div>
  );
}
