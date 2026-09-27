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
              avec son nom et son code d'accès. Par défaut, rejoindre crée une demande : les membres actuels
              du Cercle votent pour t'accepter, à la majorité — personne ne peut refuser une demande
              unilatéralement, elle reste en attente tant que le seuil n'est pas atteint. Le créateur peut
              choisir un autre mode d'admission (voir « Paramètres avancés »).
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
            <h3 className="font-bold text-slate-900 mb-2">4. Plan surprise</h3>
            <p>
              Pour préparer un anniversaire ou une fête surprise, coche <strong>« Plan surprise »</strong>{' '}
              à la création (ou plus tard en modifiant le Plan) et choisis les membres du Cercle à qui le
              cacher. Pour eux, le Plan <strong>n'existe pas</strong> : il n'apparaît dans aucune liste, et ils
              ne reçoivent ni notification ni email à son sujet. Les autres membres voient un bandeau
              rappelant pour qui c'est une surprise — chut !
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Inviter quelqu'un d'extérieur au Cercle</h3>
            <p>
              Depuis <strong>Inviter</strong> dans un Plan, l'onglet <strong>« Personne extérieure »</strong>{' '}
              donne un lien à partager (WhatsApp, SMS, QR code). La personne rejoint{' '}
              <strong>uniquement ce Plan</strong> : elle participe au chat, aux trajets, aux votes et aux
              dépenses, mais n'a accès ni au Cercle, ni à ses autres Plans, ni à ses membres. Tout membre du
              Plan peut partager ce lien ; le créateur peut en générer un nouveau pour désactiver l'ancien.
              Tes Plans d'invité se retrouvent dans « Tous mes plans », rubrique « Invitations ».
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Répondre à un Plan</h3>
            <p>
              Rejoindre un Plan, c'est dire que tu es d'accord avec sa description. Une fois membre, indique
              ta réponse en un tap : <strong>Je suis in</strong>, <strong>Peut-être</strong> ou{' '}
              <strong>Absent(e)</strong> — visible par tous les membres du Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">7. Le Chat</h3>
            <p>
              Une messagerie en temps réel propre à chaque Plan. Tape <strong>@pseudo</strong> pour
              mentionner quelqu'un — s'il est hors ligne partout, il reçoit un email en plus de la
              notification. Tu peux réagir aux messages avec des emojis et répondre dans un fil dédié.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">8. Infos, photos et sondages</h3>
            <p>
              L'onglet <strong>Infos</strong> regroupe le lieu, l'heure de rendez-vous, une liste « qui
              apporte quoi », les pièces jointes et une galerie photo. Le bouton{' '}
              <strong>« Télécharger toutes les photos »</strong> récupère toute la galerie d'un coup (fichier
              ZIP) — pense à le faire avant la date de fin du Plan. L'onglet <strong>Votes</strong> permet de
              créer un sondage (ex. « Sushi ou pizza ? »), avec l'option de le rendre anonyme. Dans un Cercle,
              un <strong>sondage de dates</strong> permet aussi de caler une date avant même de créer un Plan.
            </p>
            <p className="mt-1.5">
              Clique sur un sondage de dates pour l'ouvrir : tu vois qui est disponible à chaque date, qui
              n'est <strong>pas intéressé</strong> (bouton dédié) et qui n'a pas encore répondu, et tu peux en
              discuter dans son <strong>chat</strong>. Comme un Plan, il peut être caché à certains membres
              (sondage surprise). Quand son créateur en fait un Plan, la conversation y est reprise.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">9. Covoiturage</h3>
            <p>
              Dans l'onglet <strong>Trajets</strong>, un conducteur propose un trajet aller (lieu et heure de
              départ, nombre de places, note — par exemple l'heure du retour). Les passagers cliquent sur{' '}
              <strong>« Je monte »</strong> ou <strong>« Je descends »</strong> ; le trajet affiche les places
              libres puis « Complet ». Sans voiture ? Clique sur <strong>« Je cherche une place »</strong> en
              indiquant d'où tu pars, pour que les conducteurs te voient. Si tu passes « Absent(e) », tu es
              retiré(e) automatiquement de ton trajet (et ton trajet est annulé si tu conduisais).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">10. Dépenses partagées</h3>
            <p>
              Enregistre qui a payé quoi et pour qui dans l'onglet <strong>Dépenses</strong> : EvLY calcule
              automatiquement qui doit combien à qui, et te suggère les virements les plus simples pour
              équilibrer les comptes. Aucun argent ne transite par l'application — c'est purement
              indicatif.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">11. Décisions collectives</h3>
            <p>
              Par défaut, accepter un nouveau membre, supprimer un Cercle ou supprimer un Plan se décide{' '}
              <strong>à la majorité des membres</strong>, jamais par une seule personne (même le créateur).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">11 bis. Paramètres avancés (associations, entreprises…)</h3>
            <p>
              À la création d'un Cercle ou d'un Plan, la section <strong>Paramètres avancés</strong> permet
              d'adapter ces règles :
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li><strong>Admission dans le Cercle</strong> : vote à la majorité, validation par le créateur
                (qui peut alors accepter ou refuser), ou entrée libre avec le nom et le code.</li>
              <li><strong>Suppression</strong> du Cercle ou du Plan : vote à la majorité, ou créateur seul.</li>
              <li><strong>Modification du Plan</strong> : créateur seul, ou tous les participants pour les dates
                et le lieu (le titre et la description restent au créateur). Chaque modification apparaît dans
                l'historique avec son auteur.</li>
              <li><strong>Fonctions du Plan</strong> : masquer le chat, les trajets, les sondages, les dépenses
                ou les photos et fichiers. Infos et Membres restent toujours actifs ; une fonction masquée
                garde ses données et réapparaît si on la réactive.</li>
            </ul>
            <p className="mt-1.5">
              Ces paramètres sont visibles par tous les membres (icône réglages) et modifiables ensuite par le
              créateur seul.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">12. Story souvenir, calendrier et historique</h3>
            <p>
              Depuis les actions d'un Plan (menu ⋮ sur mobile), tu peux télécharger une{' '}
              <strong>story</strong> — une image souvenir avec le titre, la date, le lieu et qui était présent,
              au format portrait ou paysage, avec choix de la photo, recadrage et zoom. Tu peux aussi exporter
              le Plan vers ton <strong>calendrier</strong> (fichier .ics) et consulter{' '}
              l'<strong>historique des modifications</strong> (titre, dates, description).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">13. Notifications</h3>
            <p>
              Par email : création d'un nouveau Plan, rappel avant l'événement, mention @pseudo si tu es
              hors ligne, et un résumé hebdomadaire optionnel (désactivable dans les paramètres de
              notification). En temps réel dans l'app : nouveaux Plans et messages, réactions, votes,
              demandes pour rejoindre un Cercle, et covoiturage (quelqu'un monte dans ta voiture, une place
              se libère, un trajet est annulé).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">14. Suppression automatique des Plans</h3>
            <p>
              À sa date de fin, un Plan et toutes ses données (messages, photos, trajets, dépenses) sont{' '}
              <strong>supprimés automatiquement</strong> — c'est volontaire, pour garder l'app légère et
              centrée sur l'instant présent. Télécharge les photos avant (onglet Infos). Si des dépenses
              avaient été enregistrées, un <strong>résumé par email</strong> (montants et virements suggérés)
              est envoyé à chaque membre avant la suppression, pour ne perdre aucune info.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">15. Limites à connaître</h3>
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
