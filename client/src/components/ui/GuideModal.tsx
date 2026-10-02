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
              Un <strong>Cercle</strong> est ton groupe (amis, famille, collègues, club, association). Un{' '}
              <strong>Plan</strong> est une sortie précise organisée à l'intérieur d'un Cercle (ex. « Resto
              vendredi soir ? »). Chaque Plan a son propre <strong>Chat</strong>, invisible pour ceux qui ne
              l'ont pas rejoint — c'est ce qui évite qu'un anniversaire et un apéro se mélangent dans le
              même fil de discussion.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">2. Créer ou rejoindre un Cercle</h3>
            <p>
              Crée un Cercle (nom, description et couleur optionnels) avec le bouton{' '}
              <strong>« Créer un Cercle »</strong> sous « Mes Cercles », ou <strong>« Rejoindre »</strong> un Cercle avec son <strong>code d'accès</strong> (ou via un lien
              d'invitation / QR code, ou une invitation reçue dans la cloche si tu as déjà un compte). Selon le Cercle, ta demande est validée par un{' '}
              <strong>vote à la majorité</strong> des membres (par défaut), par les{' '}
              <strong>organisateurs</strong>, ou tu entres directement avec le code. En mode vote, personne ne
              peut refuser seul : la demande attend tant que la majorité n'est pas atteinte.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">3. Créer et modifier un Plan</h3>
            <p>
              Par défaut, tout membre du Cercle peut créer un Plan (bouton <strong>« Créer un Plan »</strong> en bas
              de la liste des Plans) : titre, description, date et heure de
              l'événement, lieu et limite de participants (tous optionnels sauf le titre). Une{' '}
              <strong>date de fin est obligatoire</strong> : c'est elle qui déclenche la suppression automatique,
              et un Plan ne peut pas durer plus de <strong>3 semaines</strong>. Les membres du Cercle reçoivent
              une notification et un email.
            </p>
            <p className="mt-1.5">
              Le créateur du Plan le modifie avec l'icône crayon. Il peut autoriser tous les participants à
              changer <strong>les dates et le lieu</strong> (voir « Paramètres avancés »). Un Cercle peut aussi
              réserver la création des Plans à son créateur et à ses organisateurs.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">4. Sondage de dates</h3>
            <p>
              Pas encore de date ? Dans un Cercle, <strong>« Proposer des dates »</strong> lance un sondage :
              chacun coche <strong>toutes</strong> les dates qui lui conviennent, ou clique sur{' '}
              <strong>« Pas intéressé(e) »</strong>. Clique sur le sondage pour l'ouvrir : tu vois qui est
              disponible à chaque date, qui n'est pas intéressé, qui n'a pas encore répondu, et tu peux en
              discuter dans son <strong>chat</strong>.
            </p>
            <p className="mt-1.5">
              Quand la bonne date se dégage, le créateur du sondage clique sur{' '}
              <strong>« Créer le Plan »</strong> : le Plan est créé à cette date, la conversation du sondage
              est reprise dans son chat, et le sondage disparaît.
            </p>
            <p className="mt-1.5">
              Un sondage ne dure pas indéfiniment : il se termine le lendemain de la dernière date proposée,
              et au plus tard <strong>30 jours</strong> après sa création (l'échéance est affichée en haut du
              sondage). Les dates passées ne se votent plus. La veille de l'échéance, son créateur reçoit un
              rappel par email ; sans Plan créé, le sondage est ensuite supprimé avec ses votes et son chat.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">5. Plan et sondage surprise</h3>
            <p>
              Pour préparer un anniversaire ou une fête surprise, coche <strong>« Plan surprise »</strong>{' '}
              (ou <strong>« Sondage surprise »</strong>) et choisis les membres du Cercle à qui le cacher. Pour
              eux, il <strong>n'existe pas</strong> : il n'apparaît dans aucune liste, et ils ne reçoivent ni
              notification ni email à son sujet. Les autres voient un bandeau rappelant pour qui c'est une
              surprise. Un sondage surprise transformé en Plan garde les mêmes personnes exclues — chut !
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">6. Inviter quelqu'un d'extérieur au Cercle</h3>
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
            <h3 className="font-bold text-slate-900 mb-2">7. Répondre à un Plan</h3>
            <p>
              Rejoindre un Plan, c'est dire que tu es d'accord avec sa description. Une fois membre, indique
              ta réponse en un tap : <strong>Je suis in</strong>, <strong>Peut-être</strong> ou{' '}
              <strong>Absent(e)</strong> — visible par tous les membres du Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">8. Le Chat</h3>
            <p>
              Une messagerie en temps réel propre à chaque Plan. Tape <strong>@pseudo</strong> pour
              mentionner quelqu'un — s'il est hors ligne partout, il reçoit un email en plus de la
              notification. Tu peux réagir aux messages avec des emojis et répondre dans un fil dédié.
            </p>
            <p className="mt-1.5">
              Pendant <strong>15 minutes</strong> après l'envoi, tu peux <strong>modifier</strong> ou{' '}
              <strong>supprimer</strong> ton message (liens sous le message). Un message modifié porte la
              mention « (modifié) », un message supprimé est remplacé par « Message supprimé ». Pareil dans
              le chat des sondages de dates.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">9. Infos, photos et votes</h3>
            <p>
              L'onglet <strong>Infos</strong> regroupe une liste « qui apporte quoi », les pièces jointes et une
              galerie photo. Le bouton <strong>« Télécharger toutes les photos »</strong> récupère toute la
              galerie d'un coup (fichier ZIP) — pense à le faire avant la date de fin du Plan. L'onglet{' '}
              <strong>Votes</strong> permet de lancer un sondage dans le Plan (ex. « Sushi ou pizza ? »), avec
              l'option de le rendre anonyme.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">10. Covoiturage</h3>
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
            <h3 className="font-bold text-slate-900 mb-2">11. Dépenses partagées</h3>
            <p>
              Enregistre qui a payé quoi et pour qui dans l'onglet <strong>Dépenses</strong> : EvLY calcule
              automatiquement qui doit combien à qui, et te suggère les virements les plus simples pour
              équilibrer les comptes. Aucun argent ne transite par l'application — c'est purement
              indicatif.
            </p>
            <p className="mt-1.5">
              Chaque dépense se saisit en <strong>CHF</strong> ou en <strong>euros</strong>. Les deux devises
              sont comptées séparément, sans conversion : soldes et remboursements s'affichent par devise
              (par exemple « 20.00 CHF et 15.00 € »).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">12. Rôles et décisions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Créateur du Cercle</strong> : gère le Cercle et nomme les organisateurs.</li>
              <li><strong>Organisateurs</strong> : nommés par le créateur dans la liste des membres (clic sur
                « N membres », puis « Nommer »). Ils gèrent le Cercle avec lui (paramètres, demandes d'adhésion,
                création des Plans quand elle est réservée), mais ne modifient pas les Plans des autres et ne
                peuvent pas supprimer le Cercle. Si le créateur quitte le Cercle, l'organisateur le plus ancien
                prend sa place.</li>
              <li><strong>Créateur d'un Plan</strong> : modifie son Plan, et le supprime seul si le Plan est réglé ainsi.</li>
              <li><strong>Décisions collectives</strong> : par défaut, accepter un nouveau membre, supprimer un Cercle
                ou supprimer un Plan se décide <strong>à la majorité des membres</strong>.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">13. Paramètres avancés (associations, entreprises…)</h3>
            <p>
              À la création d'un Cercle ou d'un Plan, la section <strong>Paramètres avancés</strong> permet
              d'adapter les règles :
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li><strong>Admission dans le Cercle</strong> : vote à la majorité, validation par les organisateurs
                (qui peuvent alors accepter ou refuser), ou entrée libre avec le code.</li>
              <li><strong>Création des Plans</strong> : par tous les membres, ou par le créateur et les organisateurs
                seulement.</li>
              <li><strong>Création des sondages de dates</strong> : même choix, réglé à part. Si les sondages sont
                ouverts à tous mais les Plans réservés, le créateur ou un organisateur transforme le sondage en Plan.</li>
              <li><strong>Suppression</strong> du Cercle ou du Plan : vote à la majorité, ou par son créateur seul.</li>
              <li><strong>Modification du Plan</strong> : créateur seul, ou tous les participants pour les dates
                et le lieu (le titre et la description restent au créateur).</li>
              <li><strong>Fonctions du Plan</strong> : masquer le chat, les trajets, les sondages, les dépenses
                ou les photos et fichiers. Infos et Membres restent toujours actifs ; une fonction masquée
                garde ses données et réapparaît si on la réactive.</li>
            </ul>
            <p className="mt-1.5">
              Ces paramètres sont visibles par tous les membres (icône réglages). Ceux du Cercle sont
              modifiables par le créateur et les organisateurs (la règle de suppression, par le créateur
              seul) ; ceux d'un Plan, par le créateur du Plan.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">14. Story souvenir, calendrier et historique</h3>
            <p>
              Depuis les actions d'un Plan (menu ⋮ sur mobile), tu peux télécharger une{' '}
              <strong>story</strong> — une image souvenir avec le titre, la date, le lieu et qui était présent,
              au format portrait ou paysage, avec choix de la photo, recadrage et zoom. Tu peux aussi exporter
              le Plan vers ton <strong>calendrier</strong> (fichier .ics) et consulter{' '}
              l'<strong>historique des modifications</strong> (titre, description, dates, lieu), avec le nom de
              la personne qui a fait chaque changement.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">15. Notifications et mises à jour</h3>
            <p>
              Par email : nouveau Plan, nouveau sondage de dates, rappel la veille de la fin d'un sondage que tu as lancé, rappel avant l'événement, mention @pseudo si
              tu es hors ligne, et un résumé hebdomadaire optionnel (désactivable dans « Notifications »). Dans
              l'app : nouveaux Plans, messages, sondages, demandes pour rejoindre un Cercle et covoiturage.
            </p>
            <p className="mt-1.5">
              Tout se met à jour <strong>en direct</strong>, sans recharger la page : réponses, votes,
              dépenses, photos, modifications… Quand une nouvelle version d'EvLY est en ligne, un bandeau te
              propose de recharger.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">16. Ton compte</h3>
            <p>
              Depuis le menu ☰ en bas à gauche : <strong>Mon profil</strong> (prénom, nom, et ton email :
              « Changer » envoie un lien de confirmation à la nouvelle adresse, l'ancienne restant active
              jusqu'au clic), changer ton mot de passe, gérer tes notifications, et{' '}
              <strong>supprimer ton compte</strong> à tout moment. Les Cercles et Plans que tu as créés sont
              alors confiés à d'autres membres plutôt que supprimés.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">17. Suppression automatique des Plans</h3>
            <p>
              À sa date de fin, un Plan et toutes ses données (messages, photos, trajets, dépenses) sont{' '}
              <strong>supprimés automatiquement</strong> — c'est volontaire, pour garder l'app légère et
              centrée sur l'instant présent. Télécharge les photos avant (onglet Infos). Si des dépenses
              avaient été enregistrées, un <strong>résumé par email</strong> (montants et virements suggérés)
              est envoyé à chaque membre avant la suppression, pour ne perdre aucune info.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 mb-2">18. Limites à connaître</h3>
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
