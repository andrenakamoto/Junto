import { Mail, P, PrivacyLink, Rules, type TermsSection, type TermsText } from './parts';

// Terms of use in English (translation; the French version prevails)
const sections: TermsSection[] = [
  {
    title: 'The service',
    body: <>
      <P>EvLY (“the Service”) is an event organisation app published from Geneva (“the Publisher”). It lets groups —
        relatives, friends, families, associations, clubs, teams or companies — meet in private groups (“Circles”) and
        organise around events (“Plans”): participants’ replies, polls and votes, chat, car sharing, sharing files and
        expenses, volunteer schedules, gift pots, games, random draws and holding assemblies.</P>
      <P>These terms apply to any use of the Service, on the evly.ch website and in the iPhone and Android apps, with or
        without an account. Using the Service means accepting these terms.</P>
    </>,
  },
  {
    title: 'Eligibility',
    body: <P>EvLY is for people aged 16 or over. By creating an account, you confirm that you are old enough and have the
      legal capacity to accept these terms. An organisation must not create an account or record a reply for anyone
      under 16. The Publisher may ask for proof of age and suspend any account where there is reasonable doubt.</P>,
  },
  {
    title: 'Registration and account',
    body: <>
      <P>To create an account, you provide a <strong>username</strong>, your <strong>first name</strong>, an{' '}
        <strong>email address</strong> — which you confirm through the link you receive — and a password; your last
        name is optional. You can also sign up with a Google account. The information must be accurate: your username
        and first name are visible to members of the Circles and Plans you join; your last name is only visible to you,
        except in the minutes of an assembly of your Circle (see “Assemblies and votes”).</P>
      <P>You alone are responsible for keeping your login details confidential and for all actions taken from your
        account. If you suspect unauthorised access, change your password and write to <Mail /> without delay; the
        Publisher is not liable for any use of your account before that notice. The Publisher does not verify users’
        identities.</P>
    </>,
  },
  {
    title: 'Circles, roles and guests',
    body: <>
      <P>The person who creates a Circle (the “Creator”) sets its rules: admission of new members, creation of Plans and
        polls, deletion of the Circle. They can appoint <strong>organisers</strong> to share the management of the
        Circle. When the Creator leaves the Circle or deletes their account, the Circle is handed over to another member
        (or deleted if they were the only one).</P>
      <P>A member can invite an outside person to <strong>a single Plan</strong> through a link: that person sees that
        Plan, but nothing else of the Circle. A Plan or poll can also be hidden from certain members (“Surprise Plan”).
        You are responsible for the people you invite and for sharing invitation links.</P>
      <P>An invited person can reply to a Plan <strong>without creating an account</strong>, with just their first
        name; the same applies to someone organising an outing without an account (“Organise an outing”). These people
        accept these terms by using the Service.</P>
    </>,
  },
  {
    title: 'Associations, clubs and companies',
    body: <>
      <P>When a Circle is used by an organisation, the person who creates it declares that they act with its
        agreement. <strong>The organisation alone is responsible for how it uses the Service</strong> with its members,
        volunteers, staff or guests: content of its Plans, choice of settings, decisions taken, communications sent, and
        compliance with its statutes, rules and the law.</P>
      <P>For the data of its members that it processes through the Service (inviting people, drawing up an attendance
        list or minutes, keeping documents), the organisation determines the purposes and is responsible for their
        lawfulness, in particular under the Swiss Federal Act on Data Protection (FADP): informing its members, legal
        basis, keeping the documents it downloads.</P>
    </>,
  },
  {
    title: 'Code of conduct',
    body: <>
      <P>By using EvLY, you agree:</P>
      <Rules items={[
        'not to publish hateful, discriminatory, violent, pornographic, defamatory, illegal or misleading content;',
        'to respect other people’s privacy and rights, in particular by sharing photos or information about a person only with their consent;',
        'not to impersonate another person or organisation;',
        'not to use the Service for canvassing, unsolicited advertising, spam, gambling or any fraudulent activity;',
        'not to try to access data or features you have no right to, or to disrupt the Service (reverse engineering, automated scraping, deliberate overload, circumventing limits).',
      ]} />
      <P>To report a message, use the <strong>“Report”</strong> button under it; for any other content or behaviour,
        write to <Mail />. You can also <strong>hide</strong> a person: you no longer see their messages or receive
        their notifications.</P>
    </>,
  },
  {
    title: 'Role of the Publisher and user content',
    body: <>
      <P>The Publisher provides a technical tool and <strong>hosts the content published by users</strong> (messages,
        Plans, photos, files, votes…) without creating, selecting or checking it in advance. It has no general obligation
        to monitor this content or to look for illegal activity.</P>
      <P>You remain the owner of the content you publish, but you grant the Publisher a non-exclusive, free, worldwide
        licence to host, display and transmit it to the extent necessary for the Service to work. You alone are
        responsible for this content and warrant that you hold the rights needed to share it.</P>
      <P>The Publisher may, without being obliged to and without notice, remove any content, delete any Plan or Circle,
        or restrict any account that it considers contrary to these terms or the law, or at the request of an
        authority.</P>
    </>,
  },
  {
    title: 'Events organised through the Service',
    body: <>
      <P>EvLY is a coordination tool: it makes it easier to organise real meetings and events, but{' '}
        <strong>the Publisher is not the organiser of, a party to, or a guarantor of any Plan</strong>. It does not check
        people, places or proposed activities. Joining a Plan means the member accepts its description, at their own
        responsibility.</P>
      <P><strong>Everyone takes part in events at their own risk.</strong> The Publisher accepts no liability for how
        events organised through EvLY unfold, including — without limitation — accidents, injuries, property damage,
        alcohol consumption, sporting or physical activities, one participant’s behaviour towards another,
        cancellations, withdrawals or disputes between participants. These matters are solely for the participants
        concerned, or for the organisation that set up the event.</P>
    </>,
  },
  {
    title: 'Car sharing',
    body: <P>The car-sharing feature only lets a Plan’s participants get in touch. <strong>The Publisher is not a
      carrier</strong> and plays no part in the journeys: each driver remains solely responsible for their vehicle,
      licence, insurance, compliance with traffic rules and the terms agreed with their passengers, who travel at their
      own risk.</P>,
  },
  {
    title: 'Shared expenses and gift pot',
    body: <P>Shared expenses and the gift pot keep an indicative record of who paid what, in Swiss francs or euros,
      with separate accounts for each currency and no conversion. <strong>EvLY does not process, hold or transfer any
      money</strong>: the figures shown are for information only, and payments are made outside the Service under the
      sole responsibility of the people concerned. The Publisher is not liable for input or calculation errors,
      disagreements or missed payments.</P>,
  },
  {
    title: 'Assemblies and votes',
    body: <>
      <P>The “Assembly” feature helps an organisation prepare and hold an assembly: agenda, notice, attendance,
        proxies, votes, elections and minutes. <strong>It does not replace the organisation’s statutes or the
        law</strong> (in particular articles 60 et seq. of the Swiss Civil Code). It is up to the organisation and the
        people running the assembly to set up the Service in line with their statutes — form and timing of the notice,
        voting rights, proxies, quorum, majorities — and to ensure that decisions are valid.</P>
      <P>A notice sent by EvLY (notification, email) <strong>does not guarantee compliance with the form required by the
        statutes</strong> (for example sending it by post), nor that every member receives it.</P>
      <P>A secret ballot records the fact of voting and the ballot separately, with no link between them. It is a
        practical tool, <strong>not a certified electronic voting system</strong>. The minutes are generated
        automatically: the organisation must review them, complete them if needed, sign and keep them; they include the
        first and last names of people present, represented and standing.{' '}
        <strong>The Publisher is not liable for the validity of notices, votes, elections or decisions, nor for any
        resulting disputes.</strong></P>
    </>,
  },
  {
    title: 'Games and random draws',
    body: <>
      <P>The games offered (Killer, trap word, Secret Santa, tournament…) take place in real life,{' '}
        <strong>under the sole responsibility of the participants</strong>, who agree to:</P>
      <Rules items={[
        'play with respect for everyone, their privacy and their consent;',
        'never put anyone in danger or use a dangerous object;',
        'respect the law, private places, other people’s work and road safety (never while driving);',
        'not turn them into gambling or betting.',
      ]} />
      <P>Random draws (the “Whose turn?” wheel, team draw or Secret Santa draw) are made at random by the Service. Their
        result only binds the participants who chose to use them; the Publisher is not liable for their
        consequences.</P>
    </>,
  },
  {
    title: 'Notifications, emails and reminders',
    body: <P>Notifications, emails, reminders and notices are sent with no guarantee of timing or delivery: they may be
      delayed, filtered as spam, blocked by phone or mail settings, or not sent at all if something goes wrong.{' '}
      <strong>Don’t rely on them alone for an important deadline.</strong> The Publisher is not liable for the
      consequences of a notification that is not received, received late or sent in error.</P>,
  },
  {
    title: 'Data retention and loss',
    body: <P>EvLY is not an archiving tool. Plans are <strong>deleted automatically and permanently on their end
      date</strong>, along with their chat, photos, files, votes and expenses; date polls are deleted when they expire
      (30 days at most). It is up to you to download in time anything you want to keep (photos, summary, minutes,
      documents). The Publisher does not guarantee data backup and <strong>is not liable for its loss</strong>, whether
      it results from this automatic deletion, a user’s action or a technical incident.</P>,
  },
  {
    title: 'Personal data',
    body: <>
      <P>EvLY processes the data needed for the Service to work: your account data (username, first name, optional last
        name, email, encrypted password or Google account), what you publish and some technical data. It is neither sold
        nor used for advertising; messages are encrypted in the database. Some technical providers (hosting, email
        delivery, file storage, notifications) have access to it strictly as needed for their service.</P>
      <P>Details of this processing, your rights and retention periods are set out in the{' '}
        <PrivacyLink>privacy policy</PrivacyLink>, which prevails. You can delete your account and data at any time from
        the menu (“Delete my account”). The Circles and Plans you created are then handed over to other members, and
        shared content stays in the Plans until they are deleted. Some data may be kept longer where there is a legal
        obligation or a legitimate interest (e.g. fraud prevention).</P>
    </>,
  },
  {
    title: 'Third-party services',
    body: <P>The Service relies on third-party services (hosting, file storage, email delivery, notifications, Google
      sign-in, Apple and Google app stores). Their use is subject to their own terms. The Publisher is not liable for
      their unavailability, errors or decisions.</P>,
  },
  {
    title: 'Availability and changes to the Service',
    body: <>
      <P>The Publisher does its best to keep the Service available but does not guarantee continuity, accuracy or
        freedom from errors. The Service may be changed, suspended, limited or permanently discontinued at any time, in
        whole or in part, with or without notice, without the Publisher being liable.</P>
      <P><strong>EvLY is not designed for critical use</strong>: do not use it for an emergency, people’s safety, a
        medical need, or as the only way to complete a legal or contractual formality.</P>
    </>,
  },
  {
    title: 'Intellectual property and suggestions',
    body: <P>The Service, its name, logo, texts, code and look belong to the Publisher; any reproduction or reuse without
      permission is prohibited. Ideas and suggestions you send (“Suggest an improvement”) may be used freely by the
      Publisher, without compensation.</P>,
  },
  {
    title: 'Pricing',
    body: <P>EvLY is currently free. <strong>The Publisher reserves the right to introduce paid features, subscriptions
      or any other pricing model in the future</strong>, for all or part of the Service, in particular for associations
      and companies. Existing users will be informed reasonably in advance of any pricing affecting features they
      already use. The current free offer is not a permanent commitment.</P>,
  },
  {
    title: 'Limitation of liability',
    body: <>
      <P>EvLY is provided free of charge “as is” and “as available”, without any warranty, express or implied,
        including fitness for a particular purpose.</P>
      <P><strong>To the fullest extent permitted by law, all liability of the Publisher is excluded</strong>, in
        particular for indirect or consequential damage, loss of profit, loss of data, content published by users or
        third parties, events organised through the Service and decisions taken with the help of the Service. Liability
        for damage caused intentionally or through gross negligence is reserved, as is any other liability that cannot
        be excluded under mandatory law (article 100 of the Swiss Code of Obligations). Liability for the Publisher’s
        auxiliaries and providers is excluded to the same extent.</P>
      <P>Should the Publisher nonetheless be held liable, its liability is limited to the amount actually paid by the
        user for access to the Service in the previous twelve months.</P>
    </>,
  },
  {
    title: 'Indemnity',
    body: <P>You agree to indemnify and hold the Publisher harmless against any claim, loss, liability or expense
      (including reasonable defence costs) arising from your use of the Service, the content you publish, the events,
      games or assemblies you organise, or your breach of these terms or the law. An organisation using the Service makes
      the same commitment for the use made of it by its members and organisers.</P>,
  },
  {
    title: 'Force majeure',
    body: <P>The Publisher is not liable for any failure caused by an event beyond its reasonable control: outage of a
      provider or network, cyber attack, disaster, decision of an authority, strike, epidemic or similar event.</P>,
  },
  {
    title: 'Suspension and termination',
    body: <P>The Publisher may suspend or delete an account, Circle or Plan, at its sole discretion and without notice,
      in the event of a breach of these terms, behaviour harmful to the Service or its members, or for any other
      legitimate reason. You can stop using the Service and delete your account at any time.</P>,
  },
  {
    title: 'Governing law and jurisdiction',
    body: <P>These terms are governed by Swiss law. Any dispute about their interpretation or performance falls under the
      exclusive jurisdiction of the courts of Geneva, subject to mandatory legal provisions applicable to
      consumers.</P>,
  },
  {
    title: 'Final provisions',
    body: <P>If any clause of these terms is found invalid or unenforceable, it will be replaced by a valid clause as close
      as possible to its purpose, and the other clauses will remain fully in force. The Publisher’s failure to enforce a
      clause does not constitute a waiver. These terms and the privacy policy form the entire agreement between you and
      the Publisher; <strong>the French version prevails</strong>, this translation is provided for information.</P>,
  },
  {
    title: 'Changes to these terms',
    body: <P>These terms may be updated. If there is a substantial change, you will be asked to read and accept them the
      next time you open the app. Continuing to use the Service after accepting the new version means you agree. Any
      questions: <Mail />.</P>,
  },
];

const en: TermsText = {
  title: 'Terms of use',
  version: 'Version 4 — 9 October 2026',
  news: 'New: assemblies, games, gift pot, notifications and liability.',
  translationNote: 'Translation provided for information: the French version prevails.',
  sections,
  confirm: 'By clicking “I accept the terms”, you confirm that you have read and accepted these terms of use in full.',
  scroll: 'Scroll to read the terms before accepting.',
  accept: 'I accept the terms',
  accepting: 'Saving…',
  close: 'Close',
};
export default en;
