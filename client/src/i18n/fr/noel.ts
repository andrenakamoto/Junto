// Page de campagne « Père Noël secret » (pages/SantaPage.tsx, /pere-noel) et suites : choix du Cercle sur le tableau de
// bord, message de la page d'invitation
const noel = {
  pageTitle: 'Père Noël secret – EvLY',
  badge: 'Gratuit · sans pub · hébergé en Suisse',
  title: 'Ton Père Noël secret, organisé en 2 minutes',
  subtitle: 'Tirage au sort automatique, listes d’envies et messages anonymes. Fini les petits papiers et le groupe WhatsApp où tout le monde se trahit.',
  cta: 'Organiser mon Père Noël secret',
  ctaLogged: 'Créer mon Père Noël secret',
  demo: 'Voir un exemple',
  stepsTitle: 'Comment ça marche',
  steps: {
    s1: { title: 'Crée le Plan', text: 'La date de l’échange, le budget, et c’est prêt.' },
    s2: { title: 'Invite en un lien', text: 'Envoie-le sur WhatsApp à tes collègues, ta famille ou tes amis.' },
    s3: { title: 'Lance le tirage', text: 'Chacun découvre en secret la personne qu’il gâte. Personne ne se tire soi-même.' },
  },
  featuresTitle: 'Tout est prévu',
  features: {
    draw: { title: 'Tirage juste', text: 'Automatique, en un toucher. Tu peux éviter que deux personnes (un couple…) se tirent.' },
    wishes: { title: 'Listes d’envies', text: 'Chacun note ses idées de cadeaux : plus de cadeau à côté de la plaque.' },
    messages: { title: 'Messages anonymes', text: 'Pose une question à la personne que tu gâtes sans te trahir. Elle te répond sans savoir qui tu es.' },
    budget: { title: 'Budget et date', text: 'Tout le monde connaît le montant et le jour de l’échange.' },
    reminders: { title: 'Rappels', text: 'Une semaine avant, ceux dont le cadeau n’est pas prêt reçoivent un petit rappel.' },
    reveal: { title: 'La révélation', text: 'Le jour J, l’organisateur révèle qui était le Père Noël de qui.' },
  },
  forTitle: 'Pour qui ?',
  for: {
    work: 'Entre collègues',
    family: 'En famille',
    friends: 'Entre amis',
    clubs: 'Dans ton club ou ton association',
  },
  faqTitle: 'Questions fréquentes',
  faq: {
    q1: 'C’est vraiment gratuit ?',
    a1: 'Oui, sans publicité et sans abonnement. EvLY est une application suisse, hébergée en Suisse.',
    q2: 'Faut-il un compte ?',
    a2: 'Oui, pour chaque participant : c’est ce qui permet de recevoir sa personne en secret et d’échanger anonymement. Il se crée en une minute, depuis le lien d’invitation.',
    q3: 'Et si quelqu’un se désiste après le tirage ?',
    a3: 'La chaîne se referme toute seule : la personne qui devait le gâter reçoit quelqu’un d’autre. Tu peux aussi ajouter des retardataires.',
    q4: 'On peut l’utiliser sur téléphone ?',
    a4: 'Oui : sur le site evly.ch et dans les apps iPhone et Android.',
  },
  bottomTitle: 'Prêt pour le tirage ?',
  bottomText: 'Deux minutes pour créer, un lien à envoyer, et Noël s’occupe du reste.',
  login: 'J’ai déjà un compte',
  // Tableau de bord : où créer le Plan
  chooseTitle: 'Où organiser ton Père Noël secret ?',
  chooseText: 'Dans un de tes Cercles, ou seul avec un lien à envoyer aux participants.',
  chooseLink: 'Avec un lien d’invitation',
  chooseLinkHint: 'Sans Cercle : tu invites qui tu veux',
  // Page d'invitation d'un Père Noël secret
  inviteNote: 'Pour participer au tirage, crée ton compte EvLY (gratuit, une minute) : c’est ainsi que tu découvriras en secret la personne que tu gâtes.',
  authBanner: 'Ton Père Noël secret, organisé en 2 minutes',
  authBannerSub: 'Tirage au sort, listes d’envies, messages anonymes',
  authBannerCta: 'Découvrir',
  inviteCta: 'Créer mon compte et participer',
};
export default noel;
