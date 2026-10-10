import { ProcessorTable, Section, type Processor, type PrivacyText } from './parts';

// Privacy policy in English (translation; the French version prevails)
const processors: Processor[] = [
  { name: 'Railway', role: 'hosting of the server and database (accounts, messages, Plans)', where: 'United States (California)', safeguard: 'standard contractual clauses adapted to Swiss law (data processing agreement)' },
  { name: 'Vercel', role: 'hosting of the evly.ch website', where: 'United States', safeguard: 'certified under the Swiss-U.S. Data Privacy Framework' },
  { name: 'Cloudinary', role: 'storage of photos, voice messages and files shared in Plans', where: 'United States', safeguard: 'certified under the Swiss-U.S. Data Privacy Framework' },
  { name: 'Resend', role: 'sending emails (confirmation, reminders, notifications)', where: 'United States', safeguard: 'standard contractual clauses adapted to Swiss law (data processing agreement)' },
  { name: 'Google', role: 'sign-in with a Google account (if you choose it), website fonts and delivery of app notifications (Firebase Cloud Messaging)', where: 'United States', safeguard: 'certified under the Swiss-U.S. Data Privacy Framework' },
  { name: 'Apple', role: 'delivery of iPhone app notifications (Apple Push Notification service)', where: 'United States', safeguard: 'certified under the Swiss-U.S. Data Privacy Framework' },
];

const en: PrivacyText = {
  title: 'Privacy policy',
  version: 'Version of 10 October 2026',
  translationNote: 'Translation provided for information: the French version prevails.',
  body: <>
    <p className="mt-3">
      This page explains what data EvLY processes, why, who it is shared with and what your rights are, in line with
      the Swiss Federal Act on Data Protection (FADP).
    </p>

    <Section title="1. Who is responsible for your data">
      <p>EvLY, Geneva (Switzerland). For any question or request about your data: <strong>info@evly.ch</strong>.</p>
    </Section>

    <Section title="2. The data processed">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Your account</strong>: username, first name, last name (optional), email address, language chosen for
          the app, password (stored only in encrypted form, never readable), your Google ID if you sign in with Google
          and, during a change of address, the new address awaiting confirmation (24 hours at most).</li>
        <li><strong>Replying to an invitation without an account</strong>: your first name and your reply (coming /
          maybe / not coming), plus an identifier kept in your browser to find your reply again. Erased at the end of the
          Plan, or immediately with “Withdraw my reply”. If you later create an account or log in, your reply is linked
          to it.</li>
        <li><strong>Outing organised without an account</strong> (“Organise an outing”): your first name, your outing
          (title, date, place) and an identifier kept in your browser to follow the replies. Erased with the outing, the
          day after its date. If you later create an account or log in, your outings are linked to it.</li>
        <li><strong>Invitations to a Circle</strong>: if a member invites you with your username or email, the invitation
          (who invites you, to which Circle) is kept until you accept or decline it.</li>
        <li><strong>Reports and hidden people</strong>: if you report a message, an encrypted copy of the message, your
          reason if any and your username are sent to the EvLY administrator; the copy is erased as soon as the report is
          handled. The person reported does not know who reported them. The list of people you hide is only visible to
          you.</li>
        <li><strong>Suggestions</strong> (“Suggest an improvement”): your message, its type (idea, problem, other), the
          device and app version used, and any reply from the team. Read only by the EvLY administrator, who also
          receives them by email; deleted with your account.</li>
        <li><strong>What you publish</strong>: messages and reactions, replies to Plans (yes / maybe / no), votes, Plan
          information, photos, voice messages and files, car-sharing rides, participation in games (Secret Santa,
          Killer, trap word, teams and scores, quiz answers and points) and in a gift pot (amount, payment reported), expenses and
          repayments.</li>
        <li><strong>Assemblies</strong> (a feature to turn on in a Plan): your attendance (in person or remote), the proxy
          you give or receive, and your votes. With a <strong>secret ballot</strong>, EvLY records separately that you
          voted and the ballot itself, with no link between them: nobody, neither the organiser nor the EvLY
          administrator, can find out how you voted. With a show of hands, your vote appears in the results and the
          minutes. The <strong>minutes</strong> (PDF) show the <strong>first and last names</strong> of those present,
          people represented and candidates; they are downloaded by the organiser or the secretary and emailed to the
          Plan’s creator when the assembly closes.</li>
        <li><strong>Technical data</strong>: your online status in your Circles, your login session (kept in your
          browser), the date you last used EvLY (to the hour, to count active members), the date you viewed each tab of a
          Plan (to flag what’s new, erased with the Plan) and the IP address recorded in the server logs for
          security.</li>
        <li><strong>Android and iPhone app notifications</strong>: if you allow them, your phone’s notification
          identifier, erased when you log out. A notification only says who wrote and in which Plan, Circle or poll —
          never the content of a message. You can turn them off at any time in your phone’s settings.</li>
      </ul>
      <p>We do not collect date of birth, location or address book.</p>
    </Section>

    <Section title="3. Why we use it">
      <p>
        Only to make EvLY work: letting you organise events with your Circles, sending you useful emails (account
        confirmation, new Plans, reminders, mentions, a weekly summary you can turn off), and protecting the service
        against abuse.
        <strong> No advertising, no selling of data, no profiling.</strong>
      </p>
    </Section>

    <Section title="4. Who sees what">
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Other members see your <strong>username</strong> and <strong>first name</strong>; your last name is only
          visible to you (and to the EvLY administrator, for support).</li>
        <li>Members of a Circle see its Plans and members; the content of a Plan (chat, photos, expenses…) is reserved
          for the people who have joined it.</li>
        <li>Someone invited to a single Plan only sees that Plan, nothing of the Circle.</li>
        <li>Anyone with a Plan’s <strong>invitation link</strong> sees its title, date, place, description and number of
          participants; participants’ first names only after replying. The link preview in messaging apps (WhatsApp…)
          only shows the title, date, number of participants and the organiser’s first name. The Plan’s creator can renew
          the link at any time; the old one then stops working.</li>
        <li>A Surprise Plan is invisible to the people it is hidden from.</li>
        <li>Photos, voice messages and files are only accessible from EvLY, through temporary links reserved for
          members.</li>
        <li>Messages (Plan and poll chats) are <strong>encrypted in the database</strong>, with a key kept separately: a
          copy of the database does not make them readable. Mention emails only say who mentioned you and in which Plan,
          without the content of the message.</li>
        <li>They are, however, <strong>not end-to-end encrypted</strong>: EvLY’s technical administrator can access them,
          only when necessary for the service to work or stay secure.</li>
      </ul>
    </Section>

    <Section title="5. Our providers and transfers abroad">
      <p>EvLY relies on the following providers, who process data on our behalf:</p>
      <ProcessorTable rows={processors} head={['Provider', 'Role', 'Country', 'Safeguard']} />
      <p>
        The United States does not generally offer a level of protection equivalent to Switzerland. Each transfer is
        therefore safeguarded: either the provider is certified under the Swiss-U.S. Data Privacy Framework, recognised
        by the Swiss Federal Council since 15 September 2024, or it commits to standard contractual clauses, adapted to
        Swiss law, in its data processing agreement.
      </p>
    </Section>

    <Section title="6. How long we keep it">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Plans</strong>: deleted automatically on their end date (3 weeks at most after they start), with all
          their content — messages, voice messages, photos, files, rides, expenses. If expenses were recorded, members
          receive a summary by email just before. The Plan’s creator and the Circle’s organisers can keep a{' '}
          <strong>PDF summary</strong> (info, participants with first name and username, volunteers, expenses, votes): by
          downloading it, or by email just before deletion if they turned on that option. The minutes of an assembly are
          emailed to the Plan’s creator when it closes: it is then up to the association to keep them.</li>
        <li><strong>Date polls</strong>: deleted as soon as they become a Plan (their chat carries over to the Plan),
          otherwise automatically the day after the last suggested date, and at the latest 30 days after they were
          created, with their votes and chat.</li>
        <li><strong>Account</strong>: kept until you delete it.</li>
        <li><strong>Server logs</strong>: 7 days, then erased automatically.</li>
        <li><strong>Visits to the presentation page and the brochure, number of messages sent</strong>: daily totals only,
          containing no personal data.</li>
      </ul>
    </Section>

    <Section title="7. Your rights">
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Access</strong>: get a copy of your data by writing to info@evly.ch — reply within 30 days.</li>
        <li><strong>Correction</strong>: change your first and last name in “My profile”.</li>
        <li><strong>Deletion</strong>: delete your account at any time from the menu (“Delete my account”). Your personal
          data is then erased; the Circles and Plans you created are handed over to other members, and the photos you
          shared there remain visible to them until the end of the Plan.</li>
        <li><strong>Notifications</strong>: choose in “Notifications” whether to receive them by push, email or both, and
          turn off the weekly summary.</li>
        <li><strong>Complaint</strong>: you can contact the Federal Data Protection and Information Commissioner (FDPIC,
          edoeb.admin.ch).</li>
      </ul>
    </Section>

    <Section title="8. Security">
      <p>
        Encrypted connection (HTTPS), encrypted passwords, access to photos reserved for members, limits on login
        attempts. If a data breach poses a high risk to you, we will inform the FDPIC and the people concerned.
      </p>
    </Section>

    <Section title="9. Cookies and browser storage">
      <p>
        EvLY uses no advertising or audience-measurement cookies. Your browser only keeps your login session and a few
        preferences (for example the language). If you sign in with Google, Google may set its own cookies.
      </p>
      <p className="mt-2">
        The presentation page (evly.ch/decouvrir.html) and the PDF brochure (evly.ch/brochure) count their visits
        anonymously: only a daily total is recorded, with no cookie, no IP address and no identifier. On the presentation
        page, people already logged in to EvLY are not counted. Likewise, a few sign-up steps (clicking “Create my
        account” or “Organise an outing”, outing created or shared, registration, email confirmation, first Plan) are
        counted as daily totals, without knowing who took them.
      </p>
    </Section>

    <Section title="10. Minimum age">
      <p>EvLY is for people aged 16 and over.</p>
    </Section>

    <Section title="11. Changes">
      <p>
        This policy may change; the version date above shows the latest update. If there is an important change, you
        will be informed in the app.
      </p>
    </Section>
  </>,
};
export default en;
