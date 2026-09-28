import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoIcon } from '../components/ui/Logo';

// Politique de confidentialité (nLPD). Page publique : doit être lisible avant l'inscription.

const VERSION = '28 septembre 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

const processors: { name: string; role: string; where: string; safeguard: string }[] = [
  { name: 'Railway', role: 'hébergement du serveur et de la base de données (comptes, messages, Plans)', where: 'États-Unis (Californie)', safeguard: 'clauses contractuelles types adaptées au droit suisse (contrat de traitement des données)' },
  { name: 'Vercel', role: 'hébergement du site evly.ch', where: 'États-Unis', safeguard: 'certifié Swiss-U.S. Data Privacy Framework' },
  { name: 'Cloudinary', role: 'stockage des photos et fichiers partagés dans les Plans', where: 'États-Unis', safeguard: 'certifié Swiss-U.S. Data Privacy Framework' },
  { name: 'Resend', role: 'envoi des emails (validation, rappels, notifications)', where: 'États-Unis', safeguard: 'clauses contractuelles types adaptées au droit suisse (contrat de traitement des données)' },
  { name: 'Google', role: 'connexion avec un compte Google (si tu la choisis) et polices de caractères du site', where: 'États-Unis', safeguard: 'certifié Swiss-U.S. Data Privacy Framework' },
];

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/auth" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} /> Retour
          </Link>
          <LogoIcon size={32} light />
        </div>

        <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Politique de confidentialité</h1>
            <p className="text-slate-500 mt-1">Version du {VERSION}</p>
            <p className="mt-3">
              Cette page explique quelles données EvLY traite, pourquoi, avec qui elles sont partagées et
              quels sont tes droits, conformément à la loi fédérale suisse sur la protection des données
              (LPD).
            </p>
          </header>

          <Section title="1. Qui est responsable de tes données">
            <p>
              EvLY, Genève (Suisse).
              Pour toute question ou demande concernant tes données : <strong>info@evly.ch</strong>.
            </p>
          </Section>

          <Section title="2. Les données traitées">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Ton compte</strong> : pseudo, prénom, nom (facultatif), adresse email, mot de passe
                (conservé uniquement sous forme chiffrée, jamais lisible), et ton identifiant Google si tu te
                connectes avec Google.</li>
              <li><strong>Ce que tu publies</strong> : messages et réactions, réponses aux Plans (oui /
                peut-être / non), votes, informations des Plans, photos et fichiers, trajets de covoiturage,
                dépenses et remboursements.</li>
              <li><strong>Données techniques</strong> : ton statut en ligne dans tes Cercles, ta session de
                connexion (conservée dans ton navigateur), et l'adresse IP enregistrée dans les journaux du
                serveur pour la sécurité.</li>
            </ul>
            <p>Nous ne collectons ni date de naissance, ni localisation, ni carnet d'adresses.</p>
          </Section>

          <Section title="3. Pourquoi nous les utilisons">
            <p>
              Uniquement pour faire fonctionner EvLY : te permettre d'organiser des événements avec tes
              Cercles, t'envoyer les emails utiles (validation du compte, nouveaux Plans, rappels, mentions,
              résumé hebdomadaire désactivable), et protéger le service contre les abus.
              <strong> Pas de publicité, pas de revente de données, pas de profilage.</strong>
            </p>
          </Section>

          <Section title="4. Qui voit quoi">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Les membres d'un Cercle voient ses Plans et ses membres ; le contenu d'un Plan (chat,
                photos, dépenses…) est réservé aux personnes qui l'ont rejoint.</li>
              <li>Une personne invitée à un seul Plan ne voit que ce Plan, rien du Cercle.</li>
              <li>Un Plan surprise est invisible pour les personnes à qui il est caché.</li>
              <li>Les photos et fichiers ne sont accessibles que depuis EvLY, par des liens temporaires
                réservés aux membres.</li>
              <li>Les messages (chat des Plans et des sondages) sont <strong>chiffrés dans la base de
                données</strong>, avec une clé conservée séparément : une copie de la base ne permet pas de
                les lire. Les emails de mention indiquent seulement qui t'a mentionné et dans quel Plan,
                sans le contenu du message.</li>
              <li>Ils ne sont en revanche <strong>pas chiffrés de bout en bout</strong> : l'administrateur
                technique d'EvLY peut y avoir accès, uniquement lorsque c'est nécessaire au fonctionnement ou
                à la sécurité du service.</li>
            </ul>
          </Section>

          <Section title="5. Nos prestataires et le transfert à l'étranger">
            <p>EvLY s'appuie sur les prestataires suivants, qui traitent des données pour notre compte :</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                <thead className="bg-slate-50 text-slate-600">
                  <tr><th className="p-2">Prestataire</th><th className="p-2">Rôle</th><th className="p-2">Pays</th><th className="p-2">Garantie</th></tr>
                </thead>
                <tbody>
                  {processors.map(p => (
                    <tr key={p.name} className="border-t border-slate-200 align-top">
                      <td className="p-2 font-semibold">{p.name}</td>
                      <td className="p-2">{p.role}</td>
                      <td className="p-2">{p.where}</td>
                      <td className="p-2">{p.safeguard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Les États-Unis n'offrent pas en général un niveau de protection équivalent à la Suisse.
              Chaque transfert est donc encadré : soit le prestataire est certifié au Swiss-U.S. Data
              Privacy Framework, reconnu par le Conseil fédéral depuis le 15 septembre 2024, soit il
              s'engage par les clauses contractuelles types, adaptées au droit suisse, de son contrat de
              traitement des données.
            </p>
          </Section>

          <Section title="6. Combien de temps nous les gardons">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Plans</strong> : supprimés automatiquement à leur date de fin (3 semaines au plus
                après leur début), avec tout leur contenu — messages, photos, fichiers, trajets, dépenses.
                Si des dépenses avaient été enregistrées, un résumé est envoyé par email aux membres juste
                avant.</li>
              <li><strong>Compte</strong> : conservé jusqu'à ce que tu le supprimes.</li>
              <li><strong>Journaux du serveur</strong> : 7 jours, puis effacés automatiquement.</li>
            </ul>
          </Section>

          <Section title="7. Tes droits">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Accès</strong> : obtenir une copie de tes données, en écrivant à info@evly.ch —
                réponse sous 30 jours.</li>
              <li><strong>Rectification</strong> : modifier ton prénom et ton nom dans « Mon profil ».</li>
              <li><strong>Suppression</strong> : supprimer ton compte à tout moment depuis le menu
                (« Supprimer mon compte »). Tes données personnelles sont alors effacées ; les Cercles et Plans
                que tu as créés sont confiés à d'autres membres, et les photos que tu y as partagées restent
                visibles pour eux jusqu'à la fin du Plan.</li>
              <li><strong>Emails</strong> : désactiver le résumé hebdomadaire dans « Notifications ».</li>
              <li><strong>Réclamation</strong> : tu peux t'adresser au Préposé fédéral à la protection des
                données et à la transparence (PFPDT, edoeb.admin.ch).</li>
            </ul>
          </Section>

          <Section title="8. Sécurité">
            <p>
              Connexion chiffrée (HTTPS), mots de passe chiffrés, accès aux photos réservé aux membres,
              limitation des tentatives de connexion. En cas de fuite de données présentant un risque élevé
              pour toi, nous informerons le PFPDT et les personnes concernées.
            </p>
          </Section>

          <Section title="9. Cookies et stockage dans le navigateur">
            <p>
              EvLY n'utilise aucun cookie publicitaire ni de mesure d'audience. Ton navigateur conserve
              seulement ta session de connexion et quelques préférences. Si tu te connectes avec Google,
              Google peut déposer ses propres cookies.
            </p>
          </Section>

          <Section title="10. Âge minimum">
            <p>EvLY est réservé aux personnes de 16 ans et plus.</p>
          </Section>

          <Section title="11. Modifications">
            <p>
              Cette politique peut évoluer ; la date de version ci-dessus indique la dernière mise à jour.
              En cas de changement important, tu en seras informé(e) dans l'application.
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
}
