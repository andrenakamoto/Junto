import prisma from './prisma';
import { readStored, storeFile, type FileKind } from './storage';

// Plan récurrent (lib/recurrence.ts) : les votes du Plan sont recopiés dans le suivant, **sans les réponses**,
// pour que chacun puisse revoter : sondages (questions et choix), matchs (propositions, précisions, liens et photos ;
// échéance décalée comme la date du Plan) et roues « Qui s'y colle ? » (personnes retirées et réglage conservés,
// sans les tirages).
export async function copyVotes(fromPlanId: string, toPlanId: string, offsetMs: number) {
  const [polls, matches, wheels] = await Promise.all([
    prisma.poll.findMany({ where: { planId: fromPlanId }, include: { options: true }, orderBy: { createdAt: 'asc' } }),
    prisma.matchPoll.findMany({ where: { planId: fromPlanId }, include: { options: { include: { attachment: true }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
    prisma.wheel.findMany({ where: { planId: fromPlanId }, orderBy: { createdAt: 'asc' } }),
  ]);
  for (const p of polls) {
    await prisma.poll.create({ data: { planId: toPlanId, question: p.question, anonymous: p.anonymous, options: { create: p.options.map(o => ({ text: o.text })) } } });
  }
  for (const m of matches) {
    const deadline = m.deadline ? new Date(m.deadline.getTime() + offsetMs) : null;
    const match = await prisma.matchPoll.create({ data: { planId: toPlanId, question: m.question, createdById: m.createdById, anonymous: m.anonymous, deadline } });
    for (const o of m.options) {
      const attachmentId = o.attachment ? await copyAttachment(o.attachment, toPlanId) : null;
      await prisma.matchOption.create({ data: { matchId: match.id, label: o.label, note: o.note, url: o.url, attachmentId, createdById: o.createdById } });
    }
  }
  if (wheels.length) {
    await prisma.wheel.createMany({ data: wheels.map(w => ({ planId: toPlanId, question: w.question, createdById: w.createdById, excludedUserIds: w.excludedUserIds, noRepeat: w.noRepeat })) });
  }
}

// Photo d'une proposition de match : copiée dans le dossier du nouveau Plan (celle de l'ancien Plan disparaît avec lui)
async function copyAttachment(att: { name: string; url: string; publicId: string; resourceType: string; mimeType: string; size: number; uploadedBy: string }, planId: string): Promise<string | null> {
  try {
    const stored = await storeFile(await readStored(att), planId, att.mimeType, att.resourceType as FileKind);
    const copy = await prisma.attachment.create({ data: { planId, name: att.name, mimeType: att.mimeType, size: att.size, uploadedBy: att.uploadedBy, ...stored } });
    return copy.id;
  } catch (e) {
    console.error('[recurrence] photo de match non recopiée', e);
    return null;
  }
}
