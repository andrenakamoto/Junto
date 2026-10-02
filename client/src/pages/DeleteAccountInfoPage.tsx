import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoIcon } from '../components/ui/Logo';

// Page publique « Supprimer mon compte » : exigée par Google Play (formulaire « Sécurité des
// données ») et utile à toute personne qui n'a plus accès à l'app. La suppression elle-même
// se fait dans l'app (DeleteAccountModal → POST /auth/delete-account, lib/accountDeletion.ts).
export function DeleteAccountInfoPage() {
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
            <h1 className="text-2xl font-bold text-slate-900">Supprimer mon compte EvLY</h1>
            <p className="mt-3">
              Tu peux supprimer ton compte à tout moment, directement dans l'application (Android, iPhone
              ou site evly.ch). La suppression est immédiate et définitive.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Depuis l'application</h2>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Connecte-toi à EvLY.</li>
              <li>Ouvre le menu <strong>☰</strong> en bas de la liste des Cercles.</li>
              <li>Choisis <strong>« Supprimer mon compte »</strong>.</li>
              <li>Confirme avec ton mot de passe (ou en écrivant « SUPPRIMER » pour un compte Google).</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Sans accès à l'application</h2>
            <p>
              Écris à <strong>info@evly.ch</strong> depuis l'adresse email de ton compte, en demandant la
              suppression. Nous la faisons sous 30 jours et te le confirmons par email.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Ce qui est supprimé</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Ton compte : pseudo, prénom, nom, email, mot de passe, identifiant Google.</li>
              <li>Tes messages, réactions, votes, réponses aux Plans, trajets de covoiturage et dépenses que
                tu as payées.</li>
              <li>Les identifiants de notification de tes téléphones.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Ce qui est conservé</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Les Cercles et Plans que tu as créés sont confiés au membre le plus ancien, pour ne pas
                pénaliser les autres. S'il n'y a personne d'autre, ils sont supprimés.</li>
              <li>Les photos que tu as partagées dans un Plan restent visibles pour ses participants jusqu'à la
                fin du Plan, puis sont supprimées avec lui.</li>
            </ul>
          </section>

          <p className="text-slate-500">
            Plus de détails dans la <Link to="/confidentialite" className="underline hover:text-slate-800">politique de confidentialité</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
