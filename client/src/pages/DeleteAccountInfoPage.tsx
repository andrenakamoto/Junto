import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';
import { LogoIcon } from '../components/ui/Logo';
import { currentLang, t, type Lang } from '../i18n';

// Page publique « Supprimer mon compte » : exigée par Google Play (formulaire « Sécurité des
// données ») et utile à toute personne qui n'a plus accès à l'app. La suppression elle-même
// se fait dans l'app (DeleteAccountModal → POST /auth/delete-account, lib/accountDeletion.ts).
const CONTENT: Record<Lang, ReactNode> = {
  fr: (
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
  ),
  de: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Mein EvLY-Konto löschen</h1>
        <p className="mt-3">
          Du kannst dein Konto jederzeit direkt in der App löschen (Android, iPhone oder Website evly.ch). Das Löschen
          erfolgt sofort und endgültig.
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">In der App</h2>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Melde dich bei EvLY an.</li>
          <li>Öffne das Menü <strong>☰</strong> unten in der Liste der Kreise.</li>
          <li>Wähle <strong>«Mein Konto löschen»</strong>.</li>
          <li>Bestätige mit deinem Passwort (oder mit dem verlangten Wort bei einem Google-Konto).</li>
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Ohne Zugang zur App</h2>
        <p>
          Schreib von der E-Mail-Adresse deines Kontos an <strong>info@evly.ch</strong> und verlange die Löschung. Wir
          erledigen sie innert 30 Tagen und bestätigen sie dir per E-Mail.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Was gelöscht wird</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Dein Konto: Pseudonym, Vorname, Nachname, E-Mail, Passwort, Google-Kennung.</li>
          <li>Deine Nachrichten, Reaktionen, Stimmen, Antworten auf Pläne, Fahrten und die Ausgaben, die du bezahlt hast.</li>
          <li>Die Benachrichtigungskennungen deiner Telefone.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Was erhalten bleibt</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Die Kreise und Pläne, die du erstellt hast, gehen an das älteste Mitglied, damit die anderen nicht
            benachteiligt werden. Gibt es niemanden sonst, werden sie gelöscht.</li>
          <li>Die Fotos, die du in einem Plan geteilt hast, bleiben für seine Teilnehmenden bis zum Ende des Plans sichtbar
            und werden dann mit ihm gelöscht.</li>
        </ul>
      </section>
      <p className="text-slate-500">
        Mehr Details in der <Link to="/confidentialite" className="underline hover:text-slate-800">Datenschutzerklärung</Link>.
      </p>
    </article>
  ),
  it: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Eliminare il mio account EvLY</h1>
        <p className="mt-3">
          Puoi eliminare il tuo account in qualsiasi momento, direttamente nell’app (Android, iPhone o sito evly.ch).
          L’eliminazione è immediata e definitiva.
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Dall’app</h2>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Accedi a EvLY.</li>
          <li>Apri il menu <strong>☰</strong> in fondo alla lista dei Cerchi.</li>
          <li>Scegli <strong>«Elimina il mio account»</strong>.</li>
          <li>Conferma con la tua password (o scrivendo la parola richiesta per un account Google).</li>
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Senza accesso all’app</h2>
        <p>
          Scrivi a <strong>info@evly.ch</strong> dall’indirizzo email del tuo account, chiedendo l’eliminazione. La
          effettuiamo entro 30 giorni e te la confermiamo per email.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Cosa viene eliminato</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Il tuo account: pseudonimo, nome, cognome, email, password, identificativo Google.</li>
          <li>I tuoi messaggi, reazioni, voti, risposte ai Plan, passaggi in car pooling e le spese che hai pagato.</li>
          <li>Gli identificativi di notifica dei tuoi telefoni.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Cosa viene conservato</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>I Cerchi e i Plan che hai creato passano al membro più anziano, per non penalizzare gli altri. Se non c’è
            nessun altro, vengono eliminati.</li>
          <li>Le foto che hai condiviso in un Plan restano visibili ai suoi partecipanti fino alla fine del Plan, poi sono
            eliminate con esso.</li>
        </ul>
      </section>
      <p className="text-slate-500">
        Più dettagli nell’<Link to="/confidentialite" className="underline hover:text-slate-800">informativa sulla privacy</Link>.
      </p>
    </article>
  ),
  en: (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Delete my EvLY account</h1>
        <p className="mt-3">
          You can delete your account at any time, directly in the app (Android, iPhone or the evly.ch website). Deletion
          is immediate and permanent.
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">From the app</h2>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Log in to EvLY.</li>
          <li>Open the <strong>☰</strong> menu at the bottom of the Circle list.</li>
          <li>Choose <strong>“Delete my account”</strong>.</li>
          <li>Confirm with your password (or by typing the requested word for a Google account).</li>
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">Without access to the app</h2>
        <p>
          Write to <strong>info@evly.ch</strong> from your account’s email address, asking for deletion. We do it within
          30 days and confirm it by email.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">What is deleted</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your account: username, first name, last name, email, password, Google ID.</li>
          <li>Your messages, reactions, votes, replies to Plans, car-sharing rides and the expenses you paid.</li>
          <li>Your phones’ notification identifiers.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-bold text-slate-900">What is kept</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>The Circles and Plans you created are handed over to the longest-standing member, so others aren’t affected.
            If there is nobody else, they are deleted.</li>
          <li>The photos you shared in a Plan stay visible to its participants until the end of the Plan, then are deleted
            with it.</li>
        </ul>
      </section>
      <p className="text-slate-500">
        More details in the <Link to="/confidentialite" className="underline hover:text-slate-800">privacy policy</Link>.
      </p>
    </article>
  ),
};

export function DeleteAccountInfoPage() {
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
