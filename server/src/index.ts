import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import circlesRoutes from './routes/circles';
import plansRoutes from './routes/plans';
import adminRoutes from './routes/admin';
import invitationsRoutes from './routes/invitations';
import attachmentsRoutes from './routes/attachments';
import { setupSocketHandlers } from './socket/handlers';
import prisma from './lib/prisma';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
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
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/circles', circlesRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/attachments', attachmentsRoutes);

app.set('io', io);
setupSocketHandlers(io);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Erreur serveur' });
});

async function deleteExpiredPlans() {
  try {
    const { count } = await prisma.plan.deleteMany({ where: { endDate: { lt: new Date() } } });
    if (count > 0) console.log(`[cleanup] ${count} plan(s) expiré(s) supprimé(s)`);
  } catch (e: any) {
    console.error('[cleanup] Erreur lors de la suppression des plans expirés:', e.message);
  }
}

deleteExpiredPlans();
setInterval(deleteExpiredPlans, 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
  try {
    await prisma.$connect();
    console.log('[db] Connexion base de donnees OK');
  } catch (e) {
    console.error('[db] Echec connexion base de donnees:', e);
  }
});
