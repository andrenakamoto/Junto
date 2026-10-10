import 'dotenv/config';
import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import circlesRoutes from './routes/circles';
import plansRoutes from './routes/plans';
import adminRoutes from './routes/admin';
import invitationsRoutes from './routes/invitations';
import attachmentsRoutes from './routes/attachments';
import ridesRoutes from './routes/rides';
import statsRoutes from './routes/stats';
import pushRoutes from './routes/push';
import inviteRoutes from './routes/invite';
import shareRoutes from './routes/share';
import moderationRoutes from './routes/moderation';
import suggestionRoutes from './routes/suggestions';
import expressPlanRoutes from './routes/express';
import { translateErrors } from './lib/i18n';
import quizScreenRoutes from './routes/quizScreen';
import muteRoutes from './routes/mutes';
import { setupSocketHandlers } from './socket/handlers';
import prisma from './lib/prisma';
import { sendPlanReminders, sendWeeklyDigest, deleteExpiredPlans } from './lib/reminders';
import { sendSantaReminders } from './lib/secretSanta';
import { endDueWordGames } from './lib/wordGame';
import { sendShiftReminders } from './lib/volunteers';
import { sendMatchReminders } from './lib/matchPoll';
import { spawnRecurringPlans } from './lib/recurrence';
import { createPlanInCircle } from './routes/circles';
import { encryptLegacyMessages } from './lib/messageBackfill';
import { deleteExpiredPolls, sendPollReminders } from './lib/pollCleanup';
import { deleteOrphanLightUsers } from './lib/lightGuest';

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Migration de domaine terminée (estelle.fan -> evly.ch, 2026-08-23) :
// estelle.fan a été volontairement coupé (CORS, OAuth Google, domaine
// Vercel) à la demande de l'utilisateur.
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'https://junto-appli.vercel.app',
  'https://evly.ch',
  'https://www.evly.ch',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
];

const corsOptions = {
  origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error(`CORS bloqué: ${origin}`));
  },
  credentials: true,
};

const app = express();
// Railway est un unique reverse proxy devant l'app — fait confiance au
// premier hop pour X-Forwarded-For, sinon express-rate-limit ne peut pas
// identifier les IP correctement (et applique la limite à tout le monde
// comme si c'était une seule et même IP).
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

// En-têtes de sécurité (nosniff, HSTS, pas d'intégration dans un cadre…). Pas de CSP globale :
// l'API sert aussi la page d'aperçu des invitations (routes/share.ts, l'index.html du site) ; CORP en
// cross-origin car les photos sont affichées sur www.evly.ch et dans les apps ; pas de COOP (connexion
// Google dans une fenêtre).
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(cors(corsOptions));
app.use(express.json());
// Messages d'erreur dans la langue de l'app (lib/i18n.ts)
app.use(translateErrors);

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/circles', circlesRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/express', expressPlanRoutes);
app.use('/api/mutes', muteRoutes);
app.use('/api/quiz-screen', quizScreenRoutes);

app.set('io', io);
setupSocketHandlers(io);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// En local, une base pointée sur l'environnement partagé ne doit pas être
// mutée à chaque démarrage du serveur (suppression de plans, envoi d'emails).
// RAILWAY_ENVIRONMENT_NAME n'existe que sur un déploiement Railway réel — un
// `npm run dev` local ne l'a jamais, quel que soit le DATABASE_URL pointé.
const cronEnabled = !!process.env.RAILWAY_ENVIRONMENT_NAME || process.env.ENABLE_CRON === 'true';

if (cronEnabled) {
  // Plans récurrents : le Plan suivant est créé avant la suppression des Plans passés
  const hourlyPlans = async () => { await spawnRecurringPlans(app, createPlanInCircle); await deleteExpiredPlans(); };
  hourlyPlans();
  setInterval(hourlyPlans, 60 * 60 * 1000);

  sendPlanReminders();
  setInterval(sendPlanReminders, 15 * 60 * 1000);
  // Père Noël secret : rappel une semaine avant l'échange (cadeaux pas encore prêts)
  sendSantaReminders(io);
  setInterval(() => sendSantaReminders(io), 60 * 60 * 1000);
  // Match de groupe : rappel la veille de l'échéance à ceux qui n'ont pas joué
  setInterval(() => sendMatchReminders(io), 60 * 60 * 1000);
  // Bénévoles : rappel une heure avant la prise de poste
  sendShiftReminders(io);
  setInterval(() => sendShiftReminders(io), 5 * 60 * 1000);
  // Le mot piège : fin des parties à l'heure choisie
  setInterval(() => endDueWordGames(io), 60 * 1000);

  sendWeeklyDigest();
  setInterval(sendWeeklyDigest, 60 * 60 * 1000);

  deleteExpiredPolls();
  setInterval(deleteExpiredPolls, 60 * 60 * 1000);
  deleteOrphanLightUsers();
  setInterval(deleteOrphanLightUsers, 60 * 60 * 1000);

  sendPollReminders();
  setInterval(sendPollReminders, 15 * 60 * 1000);
} else {
  console.log('[cron] Désactivé en local. Active avec ENABLE_CRON=true si besoin.');
}

const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  try {
    await prisma.$connect();
    console.log('[db] Connexion base de donnees OK');
    encryptLegacyMessages().catch(e => console.error('[messageCrypto] chiffrement des anciens messages', e));
  } catch (e) {
    console.error('[db] Echec connexion base de donnees:', e);
  }
});
