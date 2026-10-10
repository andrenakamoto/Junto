import common from './common';
import settings from './settings';
import ui from './ui';
import plan from './plan';
import auth from './auth';
import circle from './circle';
import chat from './chat';
import account from './account';
import notif from './notif';
import votes from './votes';
import games from './games';

// Textes français d'EvLY, langue d'origine. Chaque fichier = un domaine de l'app.
const fr = { common, settings, ui, plan, auth, circle, chat, account, notif, votes, games };
export default fr;

// Même structure, chaînes de caractères dans une autre langue
type DeepString<T> = { [K in keyof T]: T[K] extends string ? string : DeepString<T[K]> };
export type Dict = DeepString<typeof fr>;
