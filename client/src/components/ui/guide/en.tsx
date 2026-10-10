import { L, P, type Group, type GuideText } from './parts';

// User guide in English
const groups: Group[] = [
  {
    title: 'The basics',
    topics: [
      {
        id: 'vocabulaire', emoji: '🧭', title: 'Circle, Plan, Chat', summary: 'The three words to know',
        body: <>
          <P>A <strong>Circle</strong> is your group: friends, family, colleagues, club, association. A <strong>Plan</strong>{' '}
            is a specific event in a Circle (“Pizza on Friday?”, “Annual bingo”). Each Plan has its own{' '}
            <strong>Chat</strong> and sections: a birthday and a drinks evening never get mixed up.</P>
          <P>On the left, your Circles, then <strong>“All my plans”</strong> (by date, soonest first) and the{' '}
            <strong>Calendar</strong>. Circles and a Circle’s Plans are sorted by latest activity.</P>
        </>,
      },
      {
        id: 'cercle', emoji: '👥', title: 'Create, join, invite to a Circle', summary: 'Access code, link, QR code or invitation',
        body: <>
          <P><strong>“Create a Circle”</strong> under “My Circles” (name, description, colour). <strong>“Join a
            Circle”</strong> with its <strong>access code</strong>, a link or a QR code. If you already have an account, a
            member can also invite you by username or email: the invitation arrives in the bell 🔔.</P>
          <P>Depending on the Circle, a request is accepted by a <strong>majority vote</strong> of members (the default),
            by the organisers, or straight away. In vote mode, nobody can decline on their own.</P>
          <P>Open the member list by tapping “N members” on the Circle or the 👥 icon at the top of its Plans: who’s online,
            roles, “Invite” button.</P>
        </>,
      },
      {
        id: 'plan', emoji: '📅', title: 'Create and edit a Plan', summary: 'Title, date, place, limit, features',
        body: <>
          <P><strong>“Create a Plan”</strong> at the bottom of the Plan list: title, description, date, place, participant
            limit, <strong>important information</strong> (a box that stands out). The <strong>end date is
            required</strong>: the Plan is deleted that day (3 weeks at most after it starts). The Circle’s members are
            notified.</P>
          <P>The creator edits their Plan with the pencil; they can let everyone change the dates and place, or the important
            information. Every change is kept in the <strong>history</strong>.</P>
          <P>In <strong>“Advanced settings”</strong>, the <strong>“Plan features”</strong> list is sorted by category (Talk,
            Organise, Celebrate and give, Play): untick what you don’t need and tick the features to turn on (volunteers,
            assembly, gift pot, games…). You can change this later with the Plan’s settings icon.</P>
        </>,
      },
      {
        id: 'repondre', emoji: '✋', title: 'Replying and the waiting list', summary: 'I’m in · Maybe · Can’t make it',
        body: <>
          <P>Joining a Plan means giving your agreement: <strong>I’m in</strong>, <strong>Maybe</strong> or{' '}
            <strong>Can’t make it</strong>, visible to all participants. Others are told when someone joins or drops
            out.</P>
          <P><strong>Waiting list</strong>: a Plan with a limit is full when the “I’m in” and “Maybe” replies reach it. Join
            the waiting list: as soon as a spot opens up, you’re added automatically, in order, and notified. Your position
            shows on the card (“Waiting no. 2”).</P>
        </>,
      },
      {
        id: 'sondage-dates', emoji: '🗓️', title: 'Date poll', summary: 'Find the date before creating the Plan',
        body: <>
          <P>In a Circle, <strong>“Suggest dates”</strong>: everyone ticks all the dates that suit them, or “Not
            interested”. The poll has its own chat. When a date stands out, <strong>“Create the Plan”</strong> turns it into
            a Plan (the conversation carries over).</P>
          <P>It ends the day after the last suggested date, 30 days at most; its creator gets a reminder the day before.</P>
        </>,
      },
      {
        id: 'recurrent', emoji: '🔁', title: 'Repeating Plans', summary: 'Every week, every 2 weeks, every month',
        body: <P>When creating, choose <strong>“Repeat”</strong>: every week, every 2 weeks or every month, with an optional
          “Until”. As soon as the date has passed, the next Plan is created with the same info and settings, and replies are
          reset. Plan menu: <strong>“Cancel this time”</strong> or <strong>“Stop repeating”</strong>.</P>,
      },
      {
        id: 'surprise', emoji: '🤫', title: 'Surprise Plan and poll', summary: 'Hide a Plan from certain members',
        body: <P>Tick <strong>“Surprise Plan”</strong> and choose who to hide it from: for them it doesn’t exist (no list,
          notification or email). Others see a banner reminding them who the surprise is for.</P>,
      },
      {
        id: 'invites', emoji: '🔗', title: 'Invite someone from outside', summary: 'A link to a single Plan, with or without an account',
        body: <>
          <P><strong>Invite</strong> → “Outside guest”: a link to share (WhatsApp, text, QR code). The person sees{' '}
            <strong>this Plan only</strong>, nothing else of the Circle.</P>
          <P>Without an account, they can reply with their <strong>first name</strong> (in, maybe, I’ll pass). If they later
            create an account, their replies follow them.</P>
          <P>Outside a Circle, <strong>“Organise an outing”</strong> (login page) creates a Plan in 30 seconds, even without
            an account, kept in your personal Circle “My Plans”.</P>
        </>,
      },
    ],
  },
  {
    title: 'In a Plan',
    topics: [
      {
        id: 'fiche', emoji: '📱', title: 'The Plan page', summary: 'Cards on phones, tabs on large screens',
        body: <>
          <P>On a phone, the page shows <strong>one card per section</strong> (Chat, Info, Rides, Members, Votes, Expenses
            and features turned on). An orange dot flags something new. Back: arrow, back button or swipe from the left
            edge. At the bottom, the <strong>action bar</strong>: Invite, Photos, Calendar, Story and Summary.</P>
          <P>On computers and tablets, the sections are tabs.</P>
        </>,
      },
      {
        id: 'chat', emoji: '💬', title: 'Chat', summary: 'Mentions, reactions, photos, voice messages',
        body: <>
          <L items={[
            <><strong>@username</strong> to mention someone (notified even when muted).</>,
            <>Emoji reactions and <strong>reply threads</strong>; on a phone, tap a message to react.</>,
            <><strong>Photos</strong> (camera or gallery) and <strong>voice messages</strong> (microphone button, 2 minutes at most).</>,
            <>Edit or delete your message for <strong>15 minutes</strong>; you can delete a photo you sent at any time.</>,
            <><strong>Report</strong> a message to the EvLY team, or <strong>hide</strong> a person (their messages and notifications disappear for you).</>,
          ]} />
        </>,
      },
      {
        id: 'infos', emoji: '📋', title: 'Info, photos and files', summary: 'Important information, gallery, documents',
        body: <P>The <strong>Info</strong> section brings together the description, <strong>important information</strong>,
          files and the photo gallery. <strong>“Download all photos”</strong> gets everything at once (ZIP): do it before
          the end date. 10 MB per file, 100 MB per Plan.</P>,
      },
      {
        id: 'votes', emoji: '🗳️', title: 'Votes: poll, Match, Whose turn?', summary: 'Three ways to decide together',
        body: <>
          <L items={[
            <><strong>Poll</strong>: one question, one choice. Anonymous or not; if not, everyone sees who voted for what.</>,
            <><strong>Match</strong> ❤️: everyone says yes or no to each suggestion (swipeable cards, optional photo).
              Others’ answers stay hidden until you’ve finished. “It’s a match” when everyone said yes. The Plan’s creator
              chooses and can copy the choice into the place or the important information.</>,
            <><strong>Whose turn?</strong> 🎡: a wheel picks someone from the Plan at random (“I’m in” and “Maybe”). Untick
              the people to take off: their names are shown with the result. The wheel spins at the same time on every phone
              watching the Plan. Option “Never the same person twice”.</>,
          ]} />
        </>,
      },
      {
        id: 'trajets', emoji: '🚗', title: 'Rides (car sharing)', summary: 'Offer, ride along, look for a seat',
        body: <P>A driver offers an outbound ride (departure, time, seats, note for the way back). Passengers tap{' '}
          <strong>“I’m in”</strong>; without a car, <strong>“I’m looking for a seat”</strong>. Replying “Can’t make it”
          takes you off your ride.</P>,
      },
      {
        id: 'depenses', emoji: '💶', title: 'Expenses and “who brings what”', summary: 'List to bring, shared costs, CHF or €',
        body: <>
          <P><strong>Who brings what</strong>: a list (with quantities) where everyone taps “I’ll bring it”.</P>
          <P><strong>Expenses</strong>: who paid what for whom; EvLY works out the balances and suggests the simplest
            transfers. Francs and euros are counted separately, with no conversion. No money goes through EvLY. If there are
            expenses, a summary is emailed before the Plan is deleted.</P>
        </>,
      },
    ],
  },
  {
    title: 'Features to turn on',
    topics: [
      {
        id: 'benevoles', emoji: '🙋', title: 'Volunteers', summary: 'Shifts to fill, everyone signs up',
        body: <P>The Plan’s creator and the Circle’s organisers create the shifts (time, number of people). Signing up counts
          as “I’m in”. Summary “X people still needed”, “My shifts” filter, warning if two shifts overlap. Reminder by
          notification <strong>one hour before</strong> the shift starts.</P>,
      },
      {
        id: 'assemblee', emoji: '🏛️', title: 'Assembly', summary: 'Agenda, proxies, votes, minutes',
        body: <>
          <P>For an association’s general meeting or a committee. The Plan’s date is the date of the assembly; the Plan’s
            creator and the Circle’s organisers run it, with an optional secretary.</P>
          <L items={[
            <><strong>Before</strong>: agenda (information, vote, election) with documents, notice (app, notification,
              email), <strong>proxies</strong> to another member.</>,
            <><strong>Settings</strong>: voting members (untick passive members), quorum, check-in with the{' '}
              <strong>room code</strong>, <strong>hybrid</strong> assembly (remote participation).</>,
            <><strong>During</strong>: only people checked in vote, once for themselves and once per proxy. Live quorum,{' '}
              <strong>secret ballot</strong> or show of hands, simple, absolute or two-thirds majority, elections, decisions
              by acclamation.</>,
            <><strong>After</strong>: PDF minutes (attendees, proxies, results, people elected), sent to the Plan’s creator
              when it closes. Remember to keep them: the Plan will be deleted on its end date.</>,
          ]} />
          <P>With a secret ballot, nobody can know who voted for what. The association’s statutes prevail.</P>
        </>,
      },
      {
        id: 'cagnotte', emoji: '🐷', title: 'Gift pot', summary: 'A shared gift, ideas and votes',
        body: <P>For whom, goal, suggested amount, how to pay. Everyone states their contribution then “I’ve paid”; the
          organiser ticks “Received”. Each person’s amount is only visible to the organiser. Gift ideas with votes. No money
          goes through EvLY. Remember to hide the Plan from the person being celebrated (Surprise Plan).</P>,
      },
      {
        id: 'pere-noel', emoji: '🎅', title: 'Secret Santa', summary: 'Random draw and anonymous gifts',
        body: <P>The Plan’s date is the day of the gift exchange. Everyone writes their wishes (or “no particular wish”), the
          organiser runs the draw. You only know the person you’re spoiling; two anonymous chats let you ask questions.
          Reveal from the day of the exchange.</P>,
      },
      {
        id: 'killer', emoji: '🎯', title: 'Killer', summary: 'A target, an object, a place',
        body: <P>Each player secretly gets a target, an object and a place: get your target to hold the object in that place
          without raising suspicion. “I got my target”, the target confirms, and you take over their mission. The last one
          standing wins. Play with respect for everyone and safely.</P>,
      },
      {
        id: 'mot-piege', emoji: '🗣️', title: 'The trap word', summary: 'Get someone to say a secret word',
        body: <P>Everyone has to get their target to say a secret word without being caught. The target confirms, or unmasks
          the trapper. Points mode (live leaderboard, ends at the chosen time) or elimination.</P>,
      },
      {
        id: 'equipes', emoji: '🏆', title: 'Teams and tournament', summary: 'Balanced draw, league or knockout',
        body: <P>Team draw (2 to 8, balanced by level if you like), then a league or knockout. The organiser enters the scores
          and the standings work themselves out.</P>,
      },
    ],
  },
  {
    title: 'Staying informed',
    topics: [
      {
        id: 'notifications', emoji: '🔔', title: 'Notifications and the bell', summary: 'App, phone, email: your choice',
        body: <>
          <P>Menu ☰ → <strong>“Notifications”</strong>: notifications on your phone, emails, or both; weekly summary; PDF
            summary before your Plans are deleted.</P>
          <P>The <strong>bell</strong> 🔔 at the bottom of the Circle list gathers what you haven’t seen yet, invitations and
            requests to join. Automatic reminders: the day before a Plan, before a date poll ends, one hour before a
            volunteer shift.</P>
        </>,
      },
      {
        id: 'silence', emoji: '🔕', title: 'Mute', summary: 'Mute a Plan or a whole Circle',
        body: <P>Tap the bell on a Plan’s card (next to your reply) or at the top of a Circle’s Plan list: no more
          notifications or emails for that Plan or Circle. The orange dots stay. Still coming through: mentions, shift
          reminders, a spot freed on the waiting list and the opening of an assembly vote.</P>,
      },
    ],
  },
  {
    title: 'Rules and organisation',
    topics: [
      {
        id: 'roles', emoji: '👑', title: 'Roles and decisions', summary: 'Creator, organisers, majority votes',
        body: <L items={[
          <><strong>Circle creator</strong>: manages the Circle and appoints <strong>organisers</strong> (member list).</>,
          <><strong>Organisers</strong>: manage the Circle with them (settings, requests, reserved Plans) but don’t edit
            other people’s Plans or delete the Circle.</>,
          <><strong>Plan creator</strong>: edits their Plan and its settings.</>,
          <>By default, admitting a member and deleting a Circle or Plan are decided <strong>by majority</strong>.</>,
        ]} />,
      },
      {
        id: 'parametres', emoji: '⚙️', title: 'Advanced settings', summary: 'For associations, clubs, companies',
        body: <L items={[
          <>Circle: admission (vote, organisers, open), creating Plans and polls (everyone or organisers), deletion (vote or
            creator only).</>,
          <>Plan: Plan features, who changes the dates and place, who changes the important information, deletion.</>,
          <>Visible to everyone (settings icon); a history keeps the Circle’s changes.</>,
        ]} />,
      },
    ],
  },
  {
    title: 'Keeping a record',
    topics: [
      {
        id: 'trace', emoji: '📸', title: 'Story, calendar, summary', summary: 'Memories and documents to keep',
        body: <L items={[
          <><strong>Story</strong>: a keepsake image (title, date, place, who came) with the photo of your choice.</>,
          <><strong>Calendar</strong>: add the Plan to your calendar (.ics file).</>,
          <><strong>Summary</strong> (Plan creator and organisers): a PDF with info, participants, volunteers, expenses and votes.</>,
          <><strong>Change history</strong>: Plan menu.</>,
        ]} />,
      },
      {
        id: 'suppression', emoji: '⏳', title: 'Automatic deletion', summary: 'A Plan disappears on its end date',
        body: <P>On its end date, a Plan is deleted with all its content: it’s intentional, EvLY stays light. Before then:
          download the photos, the summary or the minutes. The time left shows on the Plan page (⏳).</P>,
      },
    ],
  },
  {
    title: 'Your account',
    topics: [
      {
        id: 'compte', emoji: '👤', title: 'Account, apps and suggestions', summary: 'Profile, apps, suggest an idea',
        body: <>
          <P>Menu ☰ at the bottom left: <strong>My profile</strong> (first name, last name, email), password,
            notifications, <strong>Suggest an improvement</strong> (and follow the reply), delete your account. Other members
            see your first name and username, never your last name (except in the minutes of an assembly).</P>
          <P><strong>Language</strong>: EvLY is available in French, German, Italian and English. Change it in{' '}
            <strong>My profile</strong>; emails and notifications follow your language.</P>
          <P>EvLY is also available as an <strong>iPhone and Android app</strong>, with notifications on your phone.
            Everything updates live; a banner offers to reload when a new version is online.</P>
        </>,
      },
      {
        id: 'limites', emoji: '📏', title: 'Limits to know', summary: 'Files, duration, Circles, username',
        body: <L items={[
          'Files: 10 MB per file, 100 MB per Plan.',
          'A Plan lasts 3 weeks at most.',
          '20 Circles created at most per person.',
          'Username: unaccented letters, numbers and _ (2 to 24 characters), not case-sensitive.',
        ]} />,
      },
    ],
  },
];

const summary: GuideText['summary'] = [
  { emoji: '👥', text: <>A <strong>Circle</strong> for each group, a <strong>Plan</strong> for each event, a chat per Plan.</> },
  { emoji: '✋', text: <>Everyone replies <strong>in / maybe / can’t make it</strong>; waiting list when it’s full.</> },
  { emoji: '🗳️', text: <>Decide together: <strong>dates</strong>, polls, <strong>Match</strong>, the <strong>Whose turn?</strong> wheel.</> },
  { emoji: '🚗', text: <>Get organised: <strong>rides</strong>, <strong>who brings what</strong>, <strong>expenses</strong>, <strong>volunteers</strong>.</> },
  { emoji: '🏛️', text: <>Associations hold their <strong>assembly</strong>: votes, proxies, minutes.</> },
  { emoji: '🎉', text: <>Have fun: <strong>gift pot</strong>, <strong>Secret Santa</strong>, <strong>Killer</strong>, <strong>trap word</strong>, <strong>tournament</strong>.</> },
  { emoji: '⏳', text: <>A Plan <strong>disappears on its end date</strong>: keep photos, summary or minutes before then.</> },
];

const en: GuideText = {
  title: 'User guide',
  subtitle: 'The essentials first, then each feature in detail',
  briefTitle: 'EvLY at a glance',
  tocTitle: 'Contents',
  close: 'Close',
  summary,
  groups,
};
export default en;
