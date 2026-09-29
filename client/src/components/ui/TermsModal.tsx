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
          <p className="text-sm text-slate-500">Version 3 — 29 septembre 2026</p>
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
              EvLY (« le Service ») est une application d'organisation d'événements, éditée depuis
              Genève (« l'Éditeur »). Elle permet à des groupes — proches, amis, familles, associations,
              clubs, équipes ou entreprises — de se retrouver au sein de groupes privés (« Cercles »)
              et de s'organiser autour d'événements (« Plans ») : réponses des participants, sondages
              de dates, conversation, covoiturage, partage de fichiers et de dépenses.
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
              Pour créer un compte, tu indiques un <strong>pseudo</strong>, ton <strong>prénom</strong>,
              une <strong>adresse email</strong> — que tu confirmes via le lien reçu — et un mot de passe ;
              ton nom est facultatif. Tu peux aussi t'inscrire avec un compte Google. Les informations
              fournies doivent être exactes : ton prénom et ton nom sont visibles des membres des Cercles
              et des Plans que tu rejoins.
            </p>
            <p className="mt-2">
              Tu es seul(e) responsable de la confidentialité de tes identifiants et des actions
              effectuées depuis ton compte. En cas de suspicion d'accès non autorisé, change ton mot de
              passe et écris sans tarder à <strong>info@evly.ch</strong> ; l'Éditeur ne saurait être tenu
              responsable d'un usage non autorisé de ton compte survenu avant cette notification.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">4. Cercles, rôles et invités</h3>
            <p>
              La personne qui crée un Cercle (le « Créateur ») en fixe les règles : admission des
              nouveaux membres (vote des membres, validation par le Créateur et les organisateurs, ou
              entrée libre avec le code), création des Plans et des sondages de dates, suppression du
              Cercle. Elle peut nommer des <strong>organisateurs</strong>, qui partagent la gestion du
              Cercle. Quand le Créateur quitte le Cercle ou supprime son compte, le Cercle est confié
              à un autre membre (ou supprimé s'il était le seul).
            </p>
            <p className="mt-2">
              Un membre peut inviter une personne extérieure à <strong>un seul Plan</strong> au moyen
              d'un lien : cette personne voit ce Plan, mais rien d'autre du Cercle. Un Plan ou un
              sondage peut aussi être caché à certains membres (« Plan surprise »). Tu es responsable
              des personnes que tu invites et du partage des liens d'invitation.
            </p>
            <p className="mt-2">
              Lorsqu'un Cercle est utilisé par une association, un club ou une entreprise, la personne
              qui le crée déclare agir avec l'accord de cette organisation. L'organisation reste
              responsable de l'usage qu'elle fait du Service avec ses membres, bénévoles, collaborateurs
              ou invités.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Règles de bonne conduite</h3>
            <p>En utilisant EvLY, tu t'engages à :</p>
            <ul className="mt-2 space-y-1.5 list-none">
              {[
                'Ne pas publier de contenus haineux, discriminatoires, violents, illégaux ou trompeurs.',
                'Respecter la vie privée des autres membres, notamment en ne partageant des photos de personnes qu\'avec leur accord.',
                "Ne pas usurper l'identité d'une autre personne ou d'une organisation.",
                "Ne pas utiliser le Service pour du démarchage, de la publicité non sollicitée, du spam ou toute activité frauduleuse.",
                "Ne pas tenter d'accéder à des données ou fonctionnalités auxquelles tu n'as pas droit, ni de perturber le fonctionnement du Service (y compris par ingénierie inverse, extraction automatisée ou surcharge délibérée).",
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Pour signaler un contenu ou un comportement contraire à ces règles, écris à{' '}
              <strong>info@evly.ch</strong>.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Événements organisés via le Service</h3>
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
              les membres concernés, ou de l'organisation qui a mis en place l'événement.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">7. Covoiturage</h3>
            <p>
              La fonction de covoiturage permet seulement aux participants d'un Plan de se mettre en
              relation. <strong>L'Éditeur n'est pas transporteur</strong> et n'intervient pas dans les
              trajets : chaque conducteur reste seul responsable de son véhicule, de son assurance, du
              respect du code de la route et des conditions convenues avec ses passagers.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">8. Partage des dépenses</h3>
            <p>
              La fonctionnalité de partage des dépenses permet aux membres d'un Plan de tenir un
              registre indicatif de qui a payé quoi, en francs suisses ou en euros, chaque devise faisant
              l'objet de comptes séparés, sans conversion. <strong>EvLY ne traite, ne détient ni ne transfère
              aucun fonds</strong> : les calculs affichés sont purement informatifs et les
              remboursements entre membres s'effectuent en dehors du Service, sous leur seule
              responsabilité. L'Éditeur n'est pas responsable des erreurs, désaccords ou défauts de
              paiement liés à ces échanges.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">9. Contenu publié et durée de conservation</h3>
            <p>
              Tu restes propriétaire des contenus que tu publies (messages, photos, fichiers,
              descriptions de Plans, etc.), mais tu accordes à l'Éditeur une licence non exclusive,
              gratuite et mondiale pour héberger, afficher et transmettre ces contenus dans la mesure
              nécessaire au fonctionnement du Service. Tu es seul(e) responsable des contenus que tu
              publies et garantis détenir les droits nécessaires pour les partager.
            </p>
            <p className="mt-2">
              EvLY n'est pas un outil d'archivage. Les Plans sont <strong>supprimés automatiquement à
              leur date de fin</strong>, avec leur conversation, leurs photos, leurs fichiers et leurs
              dépenses ; les sondages de dates le sont à leur échéance (30 jours au plus). Pense à
              télécharger ce que tu souhaites conserver. L'Éditeur peut aussi, sans obligation de le
              faire, retirer tout contenu ou supprimer tout Plan contraire aux présentes conditions ou
              à la loi.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">10. Données personnelles</h3>
            <p>
              EvLY traite les données nécessaires au fonctionnement du Service : celles de ton compte
              (pseudo, prénom, nom facultatif, email, mot de passe chiffré ou compte Google), ce que tu
              publies et quelques données techniques. Elles ne sont ni vendues, ni utilisées à des fins
              publicitaires ; les messages sont chiffrés dans la base de données. Certains prestataires
              techniques (hébergement, envoi d'emails, stockage de fichiers) y ont accès dans la stricte
              mesure nécessaire à leur prestation.
            </p>
            <p className="mt-2">
              Le détail de ces traitements, tes droits et les durées de conservation figurent dans la{' '}
              <a href="/confidentialite" target="_blank" rel="noopener" className="text-indigo-600 underline">
                politique de confidentialité
              </a>, qui fait foi. Tu peux supprimer ton compte et tes données à tout moment depuis le menu
              (« Supprimer mon compte »). Les Cercles et Plans que tu as créés sont alors confiés à
              d'autres membres, et les photos partagées restent dans les Plans. Certaines données
              peuvent être conservées au-delà en cas d'obligation légale ou d'intérêt légitime (ex.
              lutte contre la fraude).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">11. Disponibilité et évolution du Service</h3>
            <p>
              L'Éditeur s'efforce d'assurer la disponibilité du Service mais ne garantit aucune
              continuité, exactitude ou absence d'erreur. Le Service peut être modifié, suspendu,
              limité ou définitivement arrêté à tout moment, en tout ou partie, avec ou sans préavis,
              sans que la responsabilité de l'Éditeur puisse être engagée à ce titre.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">12. Évolution tarifaire</h3>
            <p>
              EvLY est actuellement proposé gratuitement. <strong>L'Éditeur se réserve le droit
              d'introduire, à l'avenir, des fonctionnalités payantes, des abonnements ou tout autre
              modèle tarifaire</strong>, pour tout ou partie du Service, notamment pour les
              associations et les entreprises. Les utilisateurs existants seront informés dans un délai
              raisonnable avant l'entrée en vigueur de toute tarification affectant des fonctionnalités
              qu'ils utilisent déjà. La gratuité actuelle ne constitue pas un engagement à titre
              définitif.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">13. Limitation de responsabilité</h3>
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
            <h3 className="font-bold text-slate-900 mb-2">14. Indemnisation</h3>
            <p>
              Tu acceptes de garantir et d'indemniser l'Éditeur contre toute réclamation, perte,
              responsabilité ou dépense (y compris les frais de défense raisonnables) résultant de ton
              utilisation du Service, du contenu que tu publies, ou de ta violation des présentes
              conditions.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">15. Suspension et résiliation</h3>
            <p>
              L'Éditeur peut suspendre ou supprimer un compte, à sa seule discrétion et sans préavis,
              en cas de violation des présentes conditions, de comportement préjudiciable au Service
              ou à ses membres, ou pour toute autre raison légitime. Tu peux à tout moment cesser
              d'utiliser le Service et supprimer ton compte.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">16. Droit applicable</h3>
            <p>
              Les présentes conditions sont régies par le droit suisse. Tout litige relatif à leur
              interprétation ou leur exécution relève de la compétence exclusive des tribunaux de
              Genève, sous réserve des dispositions légales impératives applicables aux
              consommateurs.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">17. Divisibilité</h3>
            <p>
              Si une clause des présentes conditions devait être jugée invalide ou inapplicable, les
              autres clauses resteraient pleinement en vigueur.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">18. Modification des conditions</h3>
            <p>
              Ces conditions peuvent être mises à jour. En cas de modification substantielle, tu
              seras invité(e) à les relire et à les accepter lors de ta prochaine connexion. La
              poursuite de l'utilisation du Service après acceptation de la nouvelle version vaut
              consentement. Pour toute question : <strong>info@evly.ch</strong>.
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
