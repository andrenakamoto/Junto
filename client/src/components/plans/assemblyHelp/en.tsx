import type { AssemblyHelpText } from './types';

const en: AssemblyHelpText = {
  title: 'Running an assembly',
  intro: 'Every step, from preparation to the minutes. Tap a step to open it.',
  forOrganizers: 'For the organisers',
  forMembers: 'For members',
  steps: [
    {
      id: 'reglages', emoji: '⚙️', title: '1. Set up the assembly',
      body: <>
        <p>The <b>Plan’s date</b> is the assembly’s date. The Plan’s creator and the Circle’s organisers run it; they see the
          <b> Settings</b> button:</p>
        <ul>
          <li><b>Voting members</b>: every member of the Circle votes; untick passive members or those without voting rights.</li>
          <li><b>Quorum</b>: none, a number of votes or a percentage of voters. It is calculated live during the meeting.</li>
          <li><b>Proxies</b>: allowed or not, and how many one person may hold.</li>
          <li><b>Hybrid assembly</b>: members can also take part and vote remotely.</li>
          <li><b>Notice period</b>: EvLY warns you if the notice goes out too late.</li>
          <li><b>Secretary</b> (optional): writes the notes for the minutes and can download them.</li>
        </ul>
      </>,
    },
    {
      id: 'points', emoji: '📝', title: '2. Prepare the agenda',
      body: <>
        <p><b>Add an item</b>, then choose its type:</p>
        <ul>
          <li><b>Information</b>: report, presentation, any other business. No vote.</li>
          <li><b>Vote</b>: by <b>secret ballot</b> (nobody knows who voted what) or by <b>show of hands</b> (names appear in the
            minutes). <b>Simple</b> majority (more yes than no), <b>absolute</b> majority (more than half of the votes,
            abstentions included) or <b>two thirds</b>.</li>
          <li><b>Election</b>: number of seats, then the <b>candidates</b> (added on the item’s card, before the vote opens).</li>
        </ul>
        <p>The description can be formatted (bold, lists); attach documents (accounts, report as a PDF). The ↑ ↓ arrows change
          the order. An item’s type can no longer change once its vote has opened.</p>
      </>,
    },
    {
      id: 'convoquer', emoji: '📣', title: '3. Send the notice',
      body: <>
        <p><b>Send the notice</b> goes to <b>every member of the Circle</b>: in-app notification and email with the date, place
          and agenda, whatever their notification settings. You receive a copy.</p>
        <p>You can send it again if the agenda changes (at most once every 10 minutes). The EvLY notice does not replace the form
          required by your articles of association.</p>
      </>,
    },
    {
      id: 'procurations', emoji: '🤝', title: '4. Proxies',
      body: <>
        <p>Before the assembly opens, a member who cannot come gives their proxy to another voting member, in “My attendance”.
          That person then votes twice: for themselves and for the person they represent.</p>
        <ul>
          <li>A proxy only counts if the person holding it is <b>checked in</b>.</li>
          <li>If the person who gave it comes after all and checks in, the proxy <b>lapses</b>: they vote themselves.</li>
          <li>The organisers see every proxy in “Attendance and proxies” and can refuse one.</li>
          <li>Once the assembly is open, proxies can no longer be given or withdrawn.</li>
        </ul>
      </>,
    },
    {
      id: 'ouvrir', emoji: '🔔', title: '5. Open the assembly',
      body: <>
        <p>On the day: <b>Open the assembly</b>. Members receive “The assembly is open: check in”.</p>
        <p>A 4-digit <b>room code</b> appears under the quorum. <b>Show the code full screen</b> projects it with a <b>QR code</b>
          and the number of people present, updated live.</p>
      </>,
    },
    {
      id: 'presences', emoji: '📍', title: '6. Check people in',
      body: <>
        <p>Only people who are <b>checked in</b> can vote. Two ways, usable at the same time:</p>
        <ul>
          <li><b>With a phone</b>: everyone types the room code in the “Check in” card, or scans the projected QR code (the app
            opens and checks them in by itself).</li>
          <li><b>Without a phone</b>: the organisers tick the person in “Attendance and proxies”. People not checked in yet come
            first; a search appears from 10 members.</li>
          <li><b>Remotely</b> (hybrid assembly): the person taps “I’m joining remotely”.</li>
        </ul>
        <p>The quorum (present + valid proxies) updates with every check-in.</p>
      </>,
    },
    {
      id: 'seance', emoji: '🖥️', title: '7. Go through the agenda',
      body: <>
        <p>An item’s <b>⤢</b> icon shows it <b>on its own, full screen</b>: ideal for the projector, nobody is distracted by the
          next items. “Previous” / “Next item” (or the arrow keys) move between items. Everyone can also use it on their phone.</p>
        <p><b>Notes for the minutes</b>: the organisers or the secretary sum up what was said and decided, item by item (with
          formatting). They appear in the minutes.</p>
      </>,
    },
    {
      id: 'voter', emoji: '🗳️', title: '8. Hold the votes',
      body: <>
        <ul>
          <li><b>Open the vote</b> on the item: one vote at a time. Voters get a notification (even in quiet mode) and a “Vote in
            progress — Go to the vote” banner appears at the top of the tab.</li>
          <li>Everyone votes on the item’s card, <b>once for themselves and once per proxy</b>. The “x / y have voted” counter
            moves live.</li>
          <li><b>Close the vote</b> shows the result (passed / rejected, or who is elected). <b>Cancel</b> erases the votes and puts
            the item back, in case of a mistake.</li>
          <li><b>Without a ballot</b>: “Passed by acclamation”, “Rejected without a vote” or “Elected unopposed” (as many
            candidates as seats) record the decision without voting.</li>
          <li><b>Tie</b> in an election: the organisers choose who is elected among those tied.</li>
        </ul>
      </>,
    },
    {
      id: 'sans-telephone', emoji: '📵', title: '9. Voting without a phone',
      body: <>
        <p>Someone present without a phone (or with a flat battery) can still vote, in two ways:</p>
        <ul>
          <li><b>On the organiser’s device</b>: during the vote, under “Without a phone”, choose the person then “Let someone vote
            on this device”. The screen shows only their ballot; they vote themselves (for themselves and their proxies), see
            “Vote recorded” and hand the device back. <b>The ballot stays secret</b>: look away. A tablet in the room can serve as
            a voting booth.</li>
          <li><b>On paper</b>: in the attendance list, tap <b>📄 Paper</b> next to their name <b>before opening the vote</b> (the
            button is locked during a vote, so a vote can never count twice). Their votes are no longer cast in the app. During
            the vote, enter the count under “Paper ballots” (yes / no / abstention, or ballots and votes per candidate) <b>before
            closing</b>. The result and the minutes show “including N on paper”.</li>
        </ul>
        <p>With many members without a smartphone, paper is quicker; for one or two people, the organiser’s device is enough.</p>
      </>,
    },
    {
      id: 'clore', emoji: '✅', title: '10. Close the assembly and the minutes',
      body: <>
        <ul>
          <li>First close the vote in progress, then <b>Close the assembly</b>. Those present are notified.</li>
          <li>The <b>minutes</b> (PDF) list those present (first and last name), the proxies, the quorum, every item with its
            notes, the results and those elected, with signature lines. Before closing, they are a <b>draft</b>.</li>
          <li>On closing, the minutes are emailed to the Plan’s creator. <b>Reopen</b> is still possible if something was forgotten.</li>
          <li>Keep the minutes: the Plan is deleted <b>24 hours after its end date</b>. Have them proofread and signed; the
            association’s articles prevail.</li>
        </ul>
      </>,
    },
  ],
  members: {
    id: 'membres', emoji: '🙋', title: 'What members do',
    body: <>
      <ul>
        <li><b>Before</b>: read the agenda and documents, give their proxy if they cannot come.</li>
        <li><b>In the room</b>: check in with the room code or the QR code, then vote on the item’s card when the vote opens
          (“Go to the vote” takes them there).</li>
        <li><b>Without a phone</b>: tell the organisers, who check them in and let them vote on their device or on paper.</li>
      </ul>
    </>,
  },
};

export default en;
