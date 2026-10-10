import { useState, useRef, useEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { Button } from './Button';
import { currentLang, type Lang } from '../../i18n';
import type { TermsText } from './terms/parts';
import fr from './terms/fr';
import de from './terms/de';
import it from './terms/it';
import en from './terms/en';

interface Props {
  onAccept?: () => Promise<void>;
  onClose?: () => void;
  readOnly?: boolean;
}

// Conditions d'utilisation, une version par langue (terms/*.tsx) ; la version française fait foi.
// Toute modification substantielle : dans les 4 langues, nouvelle version (champ version) ET
// CURRENT_TERMS_VERSION dans server/src/routes/auth.ts, ce qui redemande l'acceptation à tout le monde.
const TEXTS: Record<Lang, TermsText> = { fr, de, it, en };

export function TermsModal({ onAccept, onClose, readOnly = false }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const T = TEXTS[currentLang()] ?? fr;

  useEffect(() => {
    if (readOnly) { setScrolledToBottom(true); return; }
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) setScrolledToBottom(true);
  }, [readOnly]);

  function handleScroll() {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setScrolledToBottom(true);
    }
  }

  async function handleAccept() {
    if (!onAccept) return;
    setAccepting(true);
    try { await onAccept(); } finally { setAccepting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* En-tête */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <ScrollText size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{T.title}</h2>
          </div>
          <p className="text-sm text-slate-500">{T.version}</p>
          {T.translationNote && <p className="text-xs text-amber-700 mt-1">{T.translationNote}</p>}
          {!readOnly && <p className="text-xs text-slate-400 mt-1">{T.news}</p>}
        </div>

        {/* Contenu scrollable */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed"
        >
          {T.sections.map((s, i) => (
            <section key={s.title}>
              <h3 className="font-bold text-slate-900 mb-2">{i + 1}. {s.title}</h3>
              {s.body}
            </section>
          ))}

          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            {T.confirm}
          </p>
        </div>

        {/* Pied de page */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {readOnly ? (
            <Button onClick={onClose} className="w-full">
              {T.close}
            </Button>
          ) : (
            <>
              {!scrolledToBottom && (
                <p className="text-xs text-slate-400 text-center mb-3">
                  {T.scroll}
                </p>
              )}
              <Button
                onClick={handleAccept}
                disabled={!scrolledToBottom || accepting}
                className="w-full"
              >
                {accepting ? T.accepting : T.accept}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
