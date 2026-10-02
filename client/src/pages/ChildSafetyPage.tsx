import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LogoIcon } from '../components/ui/Logo';

// Normes de sécurité des enfants : page publique exigée par Google Play pour les applis de
// réseaux sociaux (déclaration « normes liées à la sécurité des enfants »). Elle doit nommer
// l'app, interdire explicitement les abus et l'exploitation sexuelle des enfants (CSAE),
// décrire le signalement dans l'app et donner un contact.
export function ChildSafetyPage() {
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
            <h1 className="text-2xl font-bold text-slate-900">EvLY — Normes de sécurité des enfants</h1>
            <p className="mt-3">
              EvLY (« Events Linked to You ») est une application d'organisation de sorties entre proches,
              réservée aux personnes de 16 ans et plus. EvLY applique une tolérance zéro envers les abus et
              l'exploitation sexuelle des enfants.
            </p>
          </header>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Ce qui est strictement interdit</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Tout contenu d'abus ou d'exploitation sexuelle d'enfants (CSAM / CSAE), quelle qu'en soit la forme :
                images, vidéos, textes, liens ou fichiers.</li>
              <li>La sollicitation, la manipulation ou la mise en relation d'un mineur à des fins sexuelles
                (pédopiégeage), ainsi que toute sexualisation de mineurs.</li>
              <li>Le partage, la promotion ou la demande de tels contenus, y compris dans les chats privés des Plans
                et des sondages.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Signaler un contenu</h2>
            <p>
              Dans l'application, chaque message d'un autre membre peut être signalé avec le bouton
              <strong> « Signaler »</strong>. Le signalement est transmis immédiatement à l'équipe EvLY, qui l'examine
              en priorité. Il est aussi possible de masquer une personne pour ne plus voir ses messages.
            </p>
            <p>
              Tu peux également écrire à <strong>info@evly.ch</strong>, y compris sans compte EvLY.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Ce que fait EvLY</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Suppression sans délai de tout contenu de ce type dès qu'il est porté à notre connaissance.</li>
              <li>Suppression définitive du compte de son auteur.</li>
              <li>Signalement aux autorités compétentes : en Suisse, l'Office fédéral de la police (fedpol), et
                lorsque c'est pertinent le National Center for Missing &amp; Exploited Children (NCMEC), ainsi que
                conservation des éléments nécessaires à l'enquête, conformément à la loi.</li>
              <li>Coopération avec les autorités sur demande légale.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Contact</h2>
            <p>
              Responsable de la sécurité des enfants pour EvLY : <strong>info@evly.ch</strong> (Genève, Suisse).
            </p>
          </section>

          <p className="text-slate-500">
            Voir aussi la <Link to="/confidentialite" className="underline hover:text-slate-800">politique de confidentialité</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
