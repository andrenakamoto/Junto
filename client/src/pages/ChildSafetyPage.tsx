import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';
import { LogoIcon } from '../components/ui/Logo';
import { currentLang, t, type Lang } from '../i18n';

// Normes de sécurité des enfants : page publique exigée par Google Play pour les applis de
// réseaux sociaux (déclaration « normes liées à la sécurité des enfants »). Elle doit nommer
// l'app, interdire explicitement les abus et l'exploitation sexuelle des enfants (CSAE),
// décrire le signalement dans l'app et donner un contact.
const CONTENT: Record<Lang, ReactNode> = {
  fr: (
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
  ),
  de: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">EvLY — Standards zum Schutz von Kindern</h1>
        <p className="mt-3">EvLY («Events Linked to You») ist eine App zum Organisieren von Treffen unter Angehörigen, vorbehalten für Personen ab 16 Jahren. EvLY verfolgt eine Null-Toleranz-Politik gegenüber sexuellem Missbrauch und sexueller Ausbeutung von Kindern.</p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Was strikt verboten ist</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Jeder Inhalt mit sexuellem Missbrauch oder sexueller Ausbeutung von Kindern (CSAM / CSAE), in welcher Form auch immer: Bilder, Videos, Texte, Links oder Dateien.</li>
          <li>Das Ansprechen, Manipulieren oder Vermitteln einer minderjährigen Person zu sexuellen Zwecken (Grooming) sowie jede Sexualisierung von Minderjährigen.</li>
          <li>Das Teilen, Bewerben oder Anfordern solcher Inhalte, auch in den privaten Chats der Pläne und Umfragen.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Inhalte melden</h2>
        <p>In der App kann jede Nachricht eines anderen Mitglieds mit der Schaltfläche <strong>«Melden»</strong> gemeldet werden. Die Meldung geht sofort an das EvLY-Team, das sie vorrangig prüft. Man kann eine Person auch ausblenden, um ihre Nachrichten nicht mehr zu sehen.</p>
        <p>Du kannst auch an <strong>info@evly.ch</strong> schreiben, auch ohne EvLY-Konto.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Was EvLY tut</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Sofortige Löschung jedes solchen Inhalts, sobald wir davon Kenntnis erhalten.</li>
          <li>Endgültige Löschung des Kontos der verantwortlichen Person.</li>
          <li>Meldung an die zuständigen Behörden: in der Schweiz an das Bundesamt für Polizei (fedpol) und, wo angebracht, an das National Center for Missing &amp; Exploited Children (NCMEC), sowie Aufbewahrung der für die Ermittlung nötigen Elemente gemäss Gesetz.</li>
          <li>Zusammenarbeit mit den Behörden auf rechtliche Anfrage.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Kontakt</h2>
        <p>Verantwortlich für den Schutz von Kindern bei EvLY: <strong>info@evly.ch</strong> (Genf, Schweiz).</p>
      </section>
      <p className="text-slate-500">Siehe auch die <Link to="/confidentialite" className="underline hover:text-slate-800">Datenschutzerklärung</Link>.</p>
    </article>
  ),
  it: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">EvLY — Standard di sicurezza dei minori</h1>
        <p className="mt-3">EvLY («Events Linked to You») è un’app per organizzare uscite tra persone care, riservata alle persone dai 16 anni in su. EvLY applica una tolleranza zero verso gli abusi e lo sfruttamento sessuale dei minori.</p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Ciò che è severamente vietato</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Qualsiasi contenuto di abuso o sfruttamento sessuale di minori (CSAM / CSAE), in qualsiasi forma: immagini, video, testi, link o file.</li>
          <li>L’adescamento, la manipolazione o la messa in contatto di un minore a fini sessuali (grooming), nonché qualsiasi sessualizzazione di minori.</li>
          <li>La condivisione, la promozione o la richiesta di tali contenuti, anche nelle chat private dei Plan e dei sondaggi.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Segnalare un contenuto</h2>
        <p>Nell’app, ogni messaggio di un altro membro può essere segnalato con il pulsante <strong>«Segnala»</strong>. La segnalazione è trasmessa immediatamente al team EvLY, che la esamina in via prioritaria. È anche possibile nascondere una persona per non vedere più i suoi messaggi.</p>
        <p>Puoi anche scrivere a <strong>info@evly.ch</strong>, anche senza account EvLY.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Cosa fa EvLY</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Eliminazione immediata di qualsiasi contenuto di questo tipo appena ne veniamo a conoscenza.</li>
          <li>Eliminazione definitiva dell’account del suo autore.</li>
          <li>Segnalazione alle autorità competenti: in Svizzera all’Ufficio federale di polizia (fedpol) e, se pertinente, al National Center for Missing &amp; Exploited Children (NCMEC), nonché conservazione degli elementi necessari all’indagine, conformemente alla legge.</li>
          <li>Cooperazione con le autorità su richiesta legale.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Contatto</h2>
        <p>Responsabile della sicurezza dei minori per EvLY: <strong>info@evly.ch</strong> (Ginevra, Svizzera).</p>
      </section>
      <p className="text-slate-500">Vedi anche l’<Link to="/confidentialite" className="underline hover:text-slate-800">informativa sulla privacy</Link>.</p>
    </article>
  ),
  en: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">EvLY — Child safety standards</h1>
        <p className="mt-3">EvLY (“Events Linked to You”) is an app for organising outings with people close to you, for people aged 16 and over. EvLY has zero tolerance for child sexual abuse and exploitation.</p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">What is strictly forbidden</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Any child sexual abuse or exploitation content (CSAM / CSAE), in any form: images, videos, texts, links or files.</li>
          <li>Soliciting, manipulating or connecting with a minor for sexual purposes (grooming), and any sexualisation of minors.</li>
          <li>Sharing, promoting or requesting such content, including in the private chats of Plans and polls.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Reporting content</h2>
        <p>In the app, any message from another member can be reported with the <strong>“Report”</strong> button. The report goes immediately to the EvLY team, who review it as a priority. You can also hide a person so you no longer see their messages.</p>
        <p>You can also write to <strong>info@evly.ch</strong>, even without an EvLY account.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">What EvLY does</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Immediate removal of any such content as soon as we become aware of it.</li>
          <li>Permanent deletion of the author’s account.</li>
          <li>Reporting to the competent authorities: in Switzerland, the Federal Office of Police (fedpol), and where relevant the National Center for Missing &amp; Exploited Children (NCMEC), and keeping what is needed for the investigation, in accordance with the law.</li>
          <li>Cooperation with the authorities upon lawful request.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Contact</h2>
        <p>Child safety contact for EvLY: <strong>info@evly.ch</strong> (Geneva, Switzerland).</p>
      </section>
      <p className="text-slate-500">See also the <Link to="/confidentialite" className="underline hover:text-slate-800">privacy policy</Link>.</p>
    </article>
  ),
};

export function ChildSafetyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/auth" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={15} /> {t('common.back')}
          </Link>
          <LogoIcon size={32} light />
        </div>

        {CONTENT[currentLang()] ?? CONTENT.fr}
      </div>
    </div>
  );
}
