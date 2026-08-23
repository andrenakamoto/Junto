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
          <p className="text-sm text-slate-500">Version 2 — 23 août 2026</p>
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
              EvLY (« le Service ») est une application de planification sociale éditée à titre
              indépendant (« l'Éditeur »), permettant à des groupes d'amis et de proches de
              s'organiser autour d'événements (« Plans ») au sein de groupes privés (« Cercles »).
              L'accès au Service peut être soumis à validation préalable par un administrateur.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">2. Éligibilité</h3>
            <p>
              L'utilisation d'EvLY est réservée aux personnes âgées d'au moins 16 ans. En créant un
              compte, tu déclares avoir l'âge requis et la capacité juridique d'accepter les présentes
              conditions. L'Éditeur se réserve le droit de demander une preuve d'âge et de suspendre
              tout compte pour lequel un doute raisonnable existerait.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">3. Inscription et compte</h3>
            <p>
              Tu dois créer un compte avec un pseudo et un mot de passe (ou via Google Sign-In). Tu es
              seul(e) responsable de la confidentialité de tes identifiants et de toutes les actions
              effectuées depuis ton compte, y compris si elles sont effectuées par un tiers ayant eu
              accès à celui-ci. En cas de suspicion d'accès non autorisé, informe immédiatement un
              administrateur ; l'Éditeur ne saurait être tenu responsable des conséquences d'un usage
              non autorisé de ton compte survenu avant cette notification.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">4. Règles de bonne conduite</h3>
            <p>En utilisant EvLY, tu t'engages à :</p>
            <ul className="mt-2 space-y-1.5 list-none">
              {[
                'Ne pas publier de contenus haineux, discriminatoires, violents, illégaux ou trompeurs.',
                'Respecter la vie privée des autres membres.',
                "Ne pas usurper l'identité d'une autre personne.",
                "Ne pas utiliser le Service à des fins commerciales, frauduleuses ou de spam.",
                "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles tu n'as pas droit, ni de perturber le fonctionnement du Service (y compris par ingénierie inverse, extraction automatisée ou surcharge délibérée).",
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Événements organisés via le Service</h3>
            <p>
              EvLY est un outil de coordination : il facilite l'organisation de rencontres et
              d'événements réels, mais <strong>l'Éditeur n'est ni organisateur, ni partie prenante,
              ni garant d'aucun Plan</strong>. Rejoindre un Plan vaut acceptation de sa description
              par le membre, sous sa seule responsabilité.
            </p>
            <p className="mt-2">
              L'Éditeur décline toute responsabilité concernant le déroulement des événements
              organisés via EvLY, y compris — sans s'y limiter — les accidents, blessures, dommages
              matériels, comportements d'un membre envers un autre, annulations, désistements ou
              litiges entre participants. Ces situations relèvent exclusivement des relations entre
              les membres concernés.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Partage des dépenses</h3>
            <p>
              La fonctionnalité de partage des dépenses permet aux membres d'un Plan de tenir un
              registre indicatif de qui a payé quoi. <strong>EvLY ne traite, ne détient ni ne
              transfère aucun fonds</strong> : les calculs affichés sont purement informatifs et les
              remboursements entre membres s'effectuent en dehors du Service, sous leur seule
              responsabilité. L'Éditeur n'est pas responsable des erreurs, désaccords ou défauts de
              paiement liés à ces échanges.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">7. Contenu publié par les utilisateurs</h3>
            <p>
              Tu restes propriétaire des contenus que tu publies (messages, photos, descriptions de
              Plans, etc.), mais tu accordes à l'Éditeur une licence non exclusive, gratuite et
              mondiale pour héberger, afficher et transmettre ces contenus dans la mesure nécessaire
              au fonctionnement du Service. Tu es seul(e) responsable des contenus que tu publies et
              garantis détenir les droits nécessaires pour les partager.
            </p>
            <p className="mt-2">
              L'Éditeur peut, sans obligation de le faire, retirer tout contenu ou supprimer tout
              Plan qu'il estime contraire aux présentes conditions ou à la loi. Les Plans sont par
              ailleurs éphémères et supprimés automatiquement à leur date de fin.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">8. Données personnelles</h3>
            <p>
              EvLY collecte les données nécessaires au fonctionnement du Service (pseudo, email le
              cas échéant, mot de passe chiffré, et les contenus que tu publies). Ces données ne sont
              pas vendues à des tiers ; certains prestataires techniques (hébergement, envoi d'emails,
              stockage de fichiers) peuvent y avoir accès dans la stricte mesure nécessaire à leur
              prestation.
            </p>
            <p className="mt-2">
              Tu peux demander la suppression de ton compte et de tes données à tout moment en
              contactant un administrateur. Certaines données peuvent être conservées au-delà en cas
              d'obligation légale ou d'intérêt légitime (ex. lutte contre la fraude).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">9. Disponibilité et évolution du Service</h3>
            <p>
              L'Éditeur s'efforce d'assurer la disponibilité du Service mais ne garantit aucune
              continuité, exactitude ou absence d'erreur. Le Service peut être modifié, suspendu,
              limité ou définitivement arrêté à tout moment, en tout ou partie, avec ou sans préavis,
              sans que la responsabilité de l'Éditeur puisse être engagée à ce titre.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">10. Évolution tarifaire</h3>
            <p>
              EvLY est actuellement proposé gratuitement. <strong>L'Éditeur se réserve le droit
              d'introduire, à l'avenir, des fonctionnalités payantes, des abonnements ou tout autre
              modèle tarifaire</strong>, pour tout ou partie du Service. Les utilisateurs existants
              seront informés dans un délai raisonnable avant l'entrée en vigueur de toute
              tarification affectant des fonctionnalités qu'ils utilisent déjà. La gratuité actuelle
              ne constitue pas un engagement à titre définitif.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">11. Limitation de responsabilité</h3>
            <p>
              EvLY est fourni « en l'état » et « selon disponibilité », sans garantie d'aucune sorte,
              explicite ou implicite. Dans toute la mesure permise par la loi applicable, l'Éditeur
              décline toute responsabilité pour les dommages indirects, accessoires, spéciaux ou
              consécutifs (perte de données, de profits, ou toute autre perte immatérielle) résultant
              de l'utilisation ou de l'impossibilité d'utiliser le Service, y compris les contenus
              publiés par des tiers. Dans la mesure où une responsabilité de l'Éditeur serait
              néanmoins retenue, elle sera limitée au montant total éventuellement payé par
              l'utilisateur pour l'accès au Service au cours des douze derniers mois.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">12. Indemnisation</h3>
            <p>
              Tu acceptes de garantir et d'indemniser l'Éditeur contre toute réclamation, perte,
              responsabilité ou dépense (y compris les frais de défense raisonnables) résultant de ton
              utilisation du Service, du contenu que tu publies, ou de ta violation des présentes
              conditions.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">13. Suspension et résiliation</h3>
            <p>
              L'Éditeur peut suspendre ou supprimer un compte, à sa seule discrétion et sans préavis,
              en cas de violation des présentes conditions, de comportement préjudiciable au Service
              ou à ses membres, ou pour toute autre raison légitime. Tu peux à tout moment cesser
              d'utiliser le Service et demander la suppression de ton compte.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">14. Droit applicable</h3>
            <p>
              Les présentes conditions sont régies par le droit suisse. Tout litige relatif à leur
              interprétation ou leur exécution relève de la compétence exclusive des tribunaux
              suisses du domicile de l'Éditeur, sous réserve des dispositions légales impératives
              applicables aux consommateurs.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">15. Divisibilité</h3>
            <p>
              Si une clause des présentes conditions devait être jugée invalide ou inapplicable, les
              autres clauses resteraient pleinement en vigueur.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">16. Modification des conditions</h3>
            <p>
              Ces conditions peuvent être mises à jour. En cas de modification substantielle, tu
              seras invité(e) à les relire et à les accepter lors de ta prochaine connexion. La
              poursuite de l'utilisation du Service après acceptation de la nouvelle version vaut
              consentement.
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
