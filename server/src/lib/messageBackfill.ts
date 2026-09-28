import prisma from './prisma';
import { encryptMessage, hasMessageKey } from './messageCrypto';

// Chiffre les messages encore en clair (écrits avant le chiffrement, ou par un
// serveur sans clé). Appelé au démarrage ; ne fait rien sans clé ni s'il ne
// reste rien à chiffrer.
export async function encryptLegacyMessages() {
  if (!hasMessageKey()) return;
  const notEncrypted = { NOT: { content: { startsWith: 'enc1:' } } };
  let count = 0;
  for (;;) {
    const batch = await prisma.message.findMany({ where: notEncrypted, select: { id: true, content: true }, take: 200 });
    if (batch.length === 0) break;
    await prisma.$transaction(batch.map(m => prisma.message.update({ where: { id: m.id }, data: { content: encryptMessage(m.content) } })));
    count += batch.length;
  }
  for (;;) {
    const batch = await prisma.circlePollMessage.findMany({ where: notEncrypted, select: { id: true, content: true }, take: 200 });
    if (batch.length === 0) break;
    await prisma.$transaction(batch.map(m => prisma.circlePollMessage.update({ where: { id: m.id }, data: { content: encryptMessage(m.content) } })));
    count += batch.length;
  }
  if (count > 0) console.log(`[messageCrypto] ${count} message(s) existant(s) chiffré(s)`);
}
