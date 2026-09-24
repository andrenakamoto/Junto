import { BookOpen } from 'lucide-react';
import { Button } from './Button';

interface Props {
  onClose: () => void;
}

export function GuideModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* En-tête */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Guide d'utilisation</h2>
          </div>
          <p className="text-sm text-slate-500">Tout ce qu'il faut savoir sur EvLY</p>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed">
          <section>
            <h3 className="font-bold text-slate-900 mb-2">1. Le vocabulaire de base</h3>
            <p>
              Un <strong>Cercle</strong> est ta bande de proches (amis, famille, collègues). Un{' '}
              <strong>Plan</strong> est une sortie précise organisée à l'intérieur d'un Cercle (ex. « Resto
              vendredi soir ? »). Chaque Plan a son propre <strong>Chat</strong>, invisible pour ceux qui ne
              l'ont pas rejoint — c'est ce qui évite qu'un anniversaire et un apéro se mélangent dans le
              même fil de discussion.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">2. Créer ou rejoindre un Cercle</h3>
            <p>
              Tu peux créer un Cercle (nom, description et couleur optionnels) ou en rejoindre un existant
              avec son nom et son code d'accès. Rejoindre crée une demande : les membres actuels du Cercle
              votent pour t'accepter, à la majorité — personne ne peut refuser une demande unilatéralement,
              elle reste en attente tant que le seuil n'est pas atteint.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">3. Créer un Plan</h3>
            <p>
              N'importe quel membre d'un Cercle peut créer un Plan : titre, description (optionnelle),
              date/heure de l'événement (optionnelle), lieu et limite de participants (optionnels). Une{' '}
              <strong>date de fin est obligatoire</strong>, et un Plan ne peut pas durer plus de{' '}
              <strong>3 semaines</strong> entre son début et sa fin. Tous les membres du Cercle (sauf le
              créateur) reçoivent un email à la création d'un nouveau Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">4. Répondre à un Plan</h3>
            <p>
              Rejoindre un Plan, c'est dire que tu es d'accord avec sa description. Une fois membre, indique
              ta réponse en un tap : <strong>Je suis in</strong>, <strong>Peut-être</strong> ou{' '}
              <strong>Absent(e)</strong> — visible par tous les membres du Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Le Chat</h3>
            <p>
              Une messagerie en temps réel propre à chaque Plan. Tape <strong>@pseudo</strong> pour
              mentionner quelqu'un — s'il est hors ligne partout, il reçoit un email en plus de la
              notification. Tu peux réagir aux messages avec des emojis et répondre dans un fil dédié.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Infos, photos et sondages</h3>
            <p>
              L'onglet <strong>Infos</strong> regroupe le lieu, l'heure de rendez-vous, une liste « qui
              apporte quoi », et une galerie photo — pratique pour retrouver les souvenirs après la sortie.
              L'onglet <strong>Votes</strong> permet de créer un sondage (ex. « Sushi ou pizza ? »), avec
              l'option de le rendre anonyme. Dans un Cercle, un <strong>sondage de dates</strong> permet
              aussi de caler une date avant même de créer un Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">7. Dépenses partagées</h3>
            <p>
              Enregistre qui a payé quoi et pour qui dans l'onglet <strong>Dépenses</strong> : EvLY calcule
              automatiquement qui doit combien à qui, et te suggère les virements les plus simples pour
              équilibrer les comptes. Aucun argent ne transite par l'application — c'est purement
              indicatif.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">8. Décisions collectives</h3>
            <p>
              Accepter un nouveau membre, supprimer un Cercle ou supprimer un Plan : tout se décide{' '}
              <strong>à la majorité des membres</strong>, jamais par une seule personne (même le créateur).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">9. Story souvenir et export calendrier</h3>
            <p>
              Depuis un Plan, tu peux télécharger une <strong>story</strong> — une image souvenir avec le
              titre, la date, le lieu et qui était présent, avec choix de la photo, recadrage et zoom.
              L'icône calendrier exporte le Plan au format .ics pour l'ajouter directement à ton agenda.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">10. Notifications</h3>
            <p>
              Par email : création d'un nouveau Plan, rappel avant l'événement, mention @pseudo si tu es
              hors ligne, et un résumé hebdomadaire optionnel (désactivable dans les paramètres de
              notification). En temps réel dans l'app : nouveaux messages, réactions, votes et demandes
              pour rejoindre un Cercle.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">11. Suppression automatique des Plans</h3>
            <p>
              À sa date de fin, un Plan et toutes ses données (messages, photos, dépenses) sont{' '}
              <strong>supprimés automatiquement</strong> — c'est volontaire, pour garder l'app légère et
              centrée sur l'instant présent. Si des dépenses avaient été enregistrées, un{' '}
              <strong>résumé par email</strong> (montants et virements suggérés) est envoyé à chaque membre
              avant la suppression, pour ne perdre aucune info.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">12. Limites à connaître</h3>
            <ul className="mt-1 space-y-1.5 list-none">
              {[
                'Pièces jointes : 10 Mo par fichier, 100 Mo cumulés par Plan.',
                'Un utilisateur peut créer au maximum 20 Cercles.',
                'Un Plan ne peut pas durer plus de 3 semaines.',
                'Le pseudo ne peut contenir que des lettres non accentuées, chiffres et underscore (2 à 24 caractères), et est insensible à la casse.',
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Pied de page */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <Button onClick={onClose} className="w-full">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
