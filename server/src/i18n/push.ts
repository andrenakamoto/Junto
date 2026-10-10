// Textes fixes des notifications push (lib/push.ts pushContent), par langue.
// {from} = @pseudo de l'auteur, {plan} = titre, {circle} = nom du Cercle, {old} = ancien nom.
type PushTexts = {
  someone: string; newMessage: string; mention: string; newPlanTitle: string; newPlan: string;
  planNews: string; santa: string; santaNews: string; killerNews: string; assembly: string; assemblyNews: string;
  wheel: string; matchNews: string; waitlist: string; volunteers: string; shiftSoon: string; words: string; wordsNews: string;
  teams: string; teamsNews: string; pot: string; potNews: string; membersNews: string; planReminder: string;
  poll: string; pollReminder: string; rides: string; ridesNews: string; newPollTitle: string; newPoll: string;
  joinRequest: string; renamed: string; invite: string; joinAccepted: string; suggestionDone: string; suggestionPlanned: string;
};

export const PUSH_TEXTS: Record<'fr' | 'de' | 'it' | 'en', PushTexts> = {
  fr: {
    someone: 'Quelqu’un', newMessage: 'Nouveau message de {from}', mention: '{from} t’a mentionné(e)',
    newPlanTitle: 'Nouveau Plan', newPlan: '{from} propose un nouveau Plan : {plan}', planNews: 'Du nouveau dans le Plan',
    santa: 'Père Noël secret', santaNews: 'Du nouveau pour le Père Noël secret', killerNews: 'Du nouveau dans la partie de Killer',
    assembly: 'Assemblée', assemblyNews: 'Du nouveau pour l’assemblée', wheel: 'La roue a parlé !', matchNews: 'Du nouveau dans un match',
    waitlist: 'Une place s’est libérée, tu es dedans !', volunteers: 'Bénévoles', shiftSoon: 'Ton poste de bénévole commence bientôt',
    words: 'Le mot piège', wordsNews: 'Du nouveau dans le mot piège', teams: 'Équipes', teamsNews: 'Du nouveau pour les équipes',
    pot: 'Cagnotte', potNews: 'Du nouveau dans la cagnotte', membersNews: 'Du changement chez les participants',
    planReminder: 'C’est demain ! Pense à vérifier les détails du Plan', poll: 'Sondage',
    pollReminder: 'Ton sondage se termine demain : crée le Plan tant qu’il est temps', rides: 'Covoiturage',
    ridesNews: 'Du nouveau dans le covoiturage', newPollTitle: 'Nouveau sondage', newPoll: '{from} lance un sondage : {plan}',
    joinRequest: '{from} demande à rejoindre le Cercle', renamed: '{from} a renommé le Cercle « {old} » en « {circle} »',
    invite: '{from} t’invite à rejoindre le Cercle', joinAccepted: 'Ta demande est acceptée : bienvenue dans le Cercle !',
    suggestionDone: 'Ta suggestion a été réalisée 🎉 Merci !', suggestionPlanned: 'Ta suggestion est prévue 🙌 Merci !',
  },
  de: {
    someone: 'Jemand', newMessage: 'Neue Nachricht von {from}', mention: '{from} hat dich erwähnt',
    newPlanTitle: 'Neuer Plan', newPlan: '{from} schlägt einen neuen Plan vor: {plan}', planNews: 'Neues im Plan',
    santa: 'Wichteln', santaNews: 'Neues beim Wichteln', killerNews: 'Neues im Killer-Spiel',
    assembly: 'Versammlung', assemblyNews: 'Neues zur Versammlung', wheel: 'Das Rad hat entschieden!', matchNews: 'Neues in einem Match',
    waitlist: 'Ein Platz ist frei geworden, du bist dabei!', volunteers: 'Helfende', shiftSoon: 'Dein Helfereinsatz beginnt bald',
    words: 'Das Fallenwort', wordsNews: 'Neues beim Fallenwort', teams: 'Teams', teamsNews: 'Neues bei den Teams',
    pot: 'Geschenkkasse', potNews: 'Neues in der Geschenkkasse', membersNews: 'Änderung bei den Teilnehmenden',
    planReminder: 'Morgen ist es so weit! Schau dir die Details des Plans an', poll: 'Umfrage',
    pollReminder: 'Deine Umfrage endet morgen: Erstelle den Plan, solange es geht', rides: 'Fahrgemeinschaft',
    ridesNews: 'Neues bei der Fahrgemeinschaft', newPollTitle: 'Neue Umfrage', newPoll: '{from} startet eine Umfrage: {plan}',
    joinRequest: '{from} möchte dem Kreis beitreten', renamed: '{from} hat den Kreis «{old}» in «{circle}» umbenannt',
    invite: '{from} lädt dich in den Kreis ein', joinAccepted: 'Deine Anfrage ist angenommen: Willkommen im Kreis!',
    suggestionDone: 'Dein Vorschlag wurde umgesetzt 🎉 Danke!', suggestionPlanned: 'Dein Vorschlag ist geplant 🙌 Danke!',
  },
  it: {
    someone: 'Qualcuno', newMessage: 'Nuovo messaggio di {from}', mention: '{from} ti ha menzionato/a',
    newPlanTitle: 'Nuovo Plan', newPlan: '{from} propone un nuovo Plan: {plan}', planNews: 'Novità nel Plan',
    santa: 'Babbo Natale segreto', santaNews: 'Novità per il Babbo Natale segreto', killerNews: 'Novità nella partita di Killer',
    assembly: 'Assemblea', assemblyNews: 'Novità per l’assemblea', wheel: 'La ruota ha parlato!', matchNews: 'Novità in un match',
    waitlist: 'Si è liberato un posto, ci sei!', volunteers: 'Volontari', shiftSoon: 'Il tuo turno di volontariato inizia presto',
    words: 'La parola trappola', wordsNews: 'Novità nella parola trappola', teams: 'Squadre', teamsNews: 'Novità per le squadre',
    pot: 'Colletta', potNews: 'Novità nella colletta', membersNews: 'Cambiamenti tra i partecipanti',
    planReminder: 'È domani! Ricordati di controllare i dettagli del Plan', poll: 'Sondaggio',
    pollReminder: 'Il tuo sondaggio termina domani: crea il Plan finché sei in tempo', rides: 'Car pooling',
    ridesNews: 'Novità nel car pooling', newPollTitle: 'Nuovo sondaggio', newPoll: '{from} lancia un sondaggio: {plan}',
    joinRequest: '{from} chiede di unirsi al Cerchio', renamed: '{from} ha rinominato il Cerchio «{old}» in «{circle}»',
    invite: '{from} ti invita a unirti al Cerchio', joinAccepted: 'La tua richiesta è stata accettata: benvenuto/a nel Cerchio!',
    suggestionDone: 'Il tuo suggerimento è stato realizzato 🎉 Grazie!', suggestionPlanned: 'Il tuo suggerimento è previsto 🙌 Grazie!',
  },
  en: {
    someone: 'Someone', newMessage: 'New message from {from}', mention: '{from} mentioned you',
    newPlanTitle: 'New Plan', newPlan: '{from} suggests a new Plan: {plan}', planNews: 'Something new in the Plan',
    santa: 'Secret Santa', santaNews: 'Something new in the Secret Santa', killerNews: 'Something new in the Killer game',
    assembly: 'Assembly', assemblyNews: 'Something new for the assembly', wheel: 'The wheel has spoken!', matchNews: 'Something new in a match',
    waitlist: 'A spot opened up, you’re in!', volunteers: 'Volunteers', shiftSoon: 'Your volunteer shift starts soon',
    words: 'The trap word', wordsNews: 'Something new in the trap word', teams: 'Teams', teamsNews: 'Something new for the teams',
    pot: 'Gift pot', potNews: 'Something new in the gift pot', membersNews: 'Changes among the participants',
    planReminder: 'It’s tomorrow! Remember to check the Plan’s details', poll: 'Poll',
    pollReminder: 'Your poll ends tomorrow: create the Plan while there’s still time', rides: 'Car sharing',
    ridesNews: 'Something new in car sharing', newPollTitle: 'New poll', newPoll: '{from} started a poll: {plan}',
    joinRequest: '{from} wants to join the Circle', renamed: '{from} renamed the Circle “{old}” to “{circle}”',
    invite: '{from} invites you to join the Circle', joinAccepted: 'Your request was accepted: welcome to the Circle!',
    suggestionDone: 'Your suggestion has been done 🎉 Thank you!', suggestionPlanned: 'Your suggestion is planned 🙌 Thank you!',
  },
};
