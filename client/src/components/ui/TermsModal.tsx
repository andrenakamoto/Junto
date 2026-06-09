import { useState, useRef, useEffect } from 'react';
import { ScrollText } from 'lucide-react';
import { Button } from './Button';

interface Props {
  onAccept?: () => Promise<void>;
  onClose?: () => void;
  readOnly?: boolean;
}

export function TermsModal({ onAccept, onClose, readOnly = false }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
            <h2 className="text-lg font-bold text-slate-900">Conditions d'utilisation</h2>
          </div>
          <p className="text-sm text-slate-500">Version 1 — 28 mai 2026</p>
        </div>

        {/* Contenu scrollable */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed"
        >
          <section>
            <h3 className="font-bold text-slate-900 mb-2">1. Présentation du service</h3>
            <p>
              Estelle est une application de planification sociale permettant à des groupes d'amis et de proches
              de s'organiser autour d'événements (appelés « Plans ») au sein de groupes privés (appelés « Cercles »).
              L'accès au service est réservé aux personnes dont l'inscription a été approuvée par un administrateur.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">2. Inscription et compte</h3>
            <p>
              Pour utiliser Estelle, tu dois créer un compte avec un pseudo et un mot de passe.
              Tu es responsable de la confidentialité de tes identifiants et de toutes les actions
              effectuées depuis ton compte. En cas de suspicion d'accès non autorisé, informe
              immédiatement un administrateur.
            </p>
            <p className="mt-2">
              Ton compte peut être suspendu ou supprimé par un administrateur en cas de non-respect
              des présentes conditions.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">3. Règles de bonne conduite</h3>
            <p>En utilisant Estelle, tu t'engages à :</p>
            <ul className="mt-2 space-y-1.5 list-none">
              {[
                'Ne pas publier de contenus haineux, discriminatoires, violents ou illégaux.',
                'Respecter la vie privée des autres membres.',
                "Ne pas usurper l'identité d'une autre personne.",
                "Ne pas utiliser le service à des fins commerciales ou de spam.",
                "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles tu n'as pas droit.",
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">4. Contenu des Plans</h3>
            <p>
              Rejoindre un Plan vaut acceptation de sa description. Tu es responsable des Plans
              que tu crées et du contenu que tu y publies (messages, votes, éléments à apporter).
              Les Plans sont éphémères et supprimés automatiquement à leur date de fin.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Données personnelles</h3>
            <p>
              Estelle collecte uniquement les données nécessaires au fonctionnement du service :
              pseudo, mot de passe (chiffré), et les contenus que tu publies. Ces données ne sont
              pas vendues ni transmises à des tiers. Elles sont hébergées sur les serveurs de
              l'administrateur du service.
            </p>
            <p className="mt-2">
              Tu peux demander la suppression de ton compte et de tes données à tout moment en
              contactant un administrateur.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Responsabilité</h3>
            <p>
              Estelle est fourni « en l'état », sans garantie de disponibilité continue.
              L'administrateur du service ne saurait être tenu responsable des contenus publiés
              par les utilisateurs ni des dommages indirects liés à l'utilisation du service.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">7. Modification des conditions</h3>
            <p>
              Ces conditions peuvent être mises à jour. En cas de modification, tu seras invité(e)
              à les relire et à les accepter lors de ta prochaine connexion. L'utilisation du service
              après acceptation de la nouvelle version vaut consentement.
            </p>
          </section>

          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            En cliquant sur « J'accepte les conditions », tu confirmes avoir lu et accepté l'intégralité
            des présentes conditions d'utilisation.
          </p>
        </div>

        {/* Pied de page */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {readOnly ? (
            <Button onClick={onClose} className="w-full">
              Fermer
            </Button>
          ) : (
            <>
              {!scrolledToBottom && (
                <p className="text-xs text-slate-400 text-center mb-3">
                  Fais défiler pour lire les conditions avant d'accepter.
                </p>
              )}
              <Button
                onClick={handleAccept}
                disabled={!scrolledToBottom || accepting}
                className="w-full"
              >
                {accepting ? 'Enregistrement...' : 'J\'accepte les conditions'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
