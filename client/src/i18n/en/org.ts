import type { Dict } from '../fr';

// Organisations (components/organisations)
const org: Dict['org'] = {
  words: { units: "Units", teams: "Teams", auto: "Automatic groups" },
  menu: { create: "Create an Organisation", createHint: "An association with several groups" },
  block: { expand: "Expand", collapse: "Collapse", manage: "Manage the Organisation", count_one: "{{count}} Circle", count_other: "{{count}} Circles" },
  models: {
    youth: { name: "Youth", hint: "Scouts, youth movement", direction: "Leader", responsible: "Team leader", members: "Parent|Young person", units: "Secretariat|Treasury|Spiritual|Equipment|Communication", teams: "Green|Orange|Blue|Red|Dark green", responsibleGroup: "Team leaders", directionGroup: "Leaders" },
    sport: { name: "Sports club", hint: "Teams, coaches, parents", direction: "Committee", responsible: "Coach", members: "Parent|Player", units: "Finance|Refreshments|Tournaments", teams: "U9|U11|Seniors", responsibleGroup: "Coaches", directionGroup: "Committee" },
    choir: { name: "Choir or music", hint: "Sections, committee", direction: "Committee", responsible: "Section leader", members: "Singer", units: "Concerts|Treasury", teams: "Sopranos|Altos|Tenors|Basses", responsibleGroup: "Section leaders", directionGroup: "Committee" },
    committee: { name: "Association with a committee", hint: "A committee and its members", direction: "Committee", responsible: "Coordinator", members: "Member", units: "Treasury|Events|Communication", teams: "Members", responsibleGroup: "Coordinators", directionGroup: "Committee" },
    blank: { name: "Blank", hint: "Write everything yourself", direction: "Leadership", responsible: "Coordinator", members: "Member", units: "", teams: "", responsibleGroup: "Coordinators", directionGroup: "Leadership" },
  },
  create: {
    title: "Create an Organisation", stepOf: "Step {{step}} of {{total}}",
    nameLabel: "Organisation name", namePlaceholder: "e.g. Carouge Scouts", chooseModel: "Which template fits you best?", modelNote: "You can change everything in the next step.",
    rolesTitle: "Roles", directionLabel: "Leadership role", responsibleLabel: "Team coordinators’ role", memberRolesLabel: "Members’ roles",
    addRole: "Add a role", unitsHelp: "The leadership’s working groups.", teamsHelp: "The groups of members, with the role given on joining.", labelOf: "What do you call them?",
    addUnit: "Add", addTeam: "Add", newItem: "Name", remove: "Remove",
    autoTitle: "Automatic groups", autoHelp: "Normal Circles whose list EvLY keeps: someone appointed joins automatically, and leaves when they no longer have that role.",
    autoResponsibles: "A Circle for all coordinators", autoDirection: "A Circle for all the leadership", groupName: "Circle name", alsoUnits: "Also with the members of:",
    summary_one: "EvLY will create {{count}} Circle. You’ll be a member, muted in the teams.", summary_other: "EvLY will create {{count}} Circles. You’ll be a member, muted in the teams.",
    back: "Back", next: "Continue", submit: "Create the Organisation", creating: "Creating…",
    needName: "Enter the organisation’s name", needRoles: "Enter the names of the roles", needMemberRole: "Enter at least one member role", needCircle: "Add at least one unit or team",
  },
  manage: {
    title: "Organisation", tabCircles: "Circles", tabRights: "Rights", tabPeople: "People",
    members_one: "{{count}} member", members_other: "{{count}} members", integrate: "Join", integrated: "Member", code: "Code", copyCode: "Copy code", copied: "Copied",
    showMembers: "Show members", hideMembers: "Hide members", role: "Role", noMember: "Nobody yet.", integratedTag: "Leadership",
    integrateNote: "You join in discreet mode: the Circle stays muted unless someone mentions you.",
    fixedOrder: "Always keep the same order", fixedOrderHint: "Circles stay in this order for all members, whatever sorting is chosen.", moveUp: "Move up", moveDown: "Move down",
    acceptAs: "Accept as:", search: "Search for a person", addTo: "Add to a Circle…", remove: "Remove", confirmRemove: "Confirm", automatic: "Automatic", circleCount_one: "{{count}} Circle", circleCount_other: "{{count}} Circles",
    rightsHelp: "What each role can do. Other members don’t see this table.", rightsAction: "Action",
    direction: "Leadership", admin: "Administration", peopleHelp: "Tap a person to see their Circles, give them a role (team leader…) or add them to a team. They must first have joined one of the Organisation’s Circles.", makeDirection: "Add to the leadership", removeDirection: "Remove from the leadership",
    actions: {
      create_plan: "Create a Plan", create_poll: "Create a date poll", write_plan_chat: "Write in a Plan’s chat", add_files: "Add photos and files",
      send_announcement: "Send an announcement",
      manage_shifts: "Manage Schedule shifts", invite_guests: "Invite outside people", see_money: "See supplier amounts", manage_members: "Manage members and roles", integrate_all: "Join all Circles",
    },
  },
  discussion: { title: "Who writes in the Discussion?", help: "Coordinators and the leadership can always write." },
  audience: {"title": "Who is it for?", "all": "The whole organisation", "roles": "In these teams", "rolesHint": "No role ticked: everyone.", "count_one": "{{count}} person will receive this Plan", "count_other": "{{count}} people will receive this Plan", "pollCount_one": "{{count}} person will receive this poll", "pollCount_other": "{{count}} people will receive this poll", "none": "Choose at least one Circle", "multiNote": "The participant list will be reserved for the organisation (can be changed in Rules)."},
  chat: { ttl: "Messages kept for 3 months, photos for 1 month.", photoExpired: "Photo expired", older: "Earlier messages" },
  announce: {"title": "Send an announcement", "banner": "Announcement", "intro": "It appears in the Discussion of each chosen Circle and stays visible for 3 months.", "message": "Your message", "placeholder": "e.g. The clubhouse is closed on Saturday.", "forWho": "In which Circles?", "all": "The whole organisation", "count_one": "{{count}} person will receive this announcement", "count_other": "{{count}} people will receive this announcement", "empty": "Write your message", "none": "Choose at least one Circle", "send": "Send the announcement", "sending": "Sending…", "sent_one": "Announcement sent to {{count}} Circle.", "sent_other": "Announcement sent to {{count}} Circles.", "skipped": "Not sent to: {{names}} (Discussion switched off).", "recent": "My recent announcements", "in": "In: {{names}}", "edit": "Edit", "save": "Save", "remove": "Delete everywhere", "confirmRemove": "Confirm deletion"},
  plan: { readOnlyChat: "Your role doesn’t allow you to write in this chat." },
};
export default org;
