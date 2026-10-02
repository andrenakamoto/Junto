// Données d'un message de chat renvoyées au client (REST et temps réel) : auteur, réactions,
// nombre de réponses et photo éventuelle (jamais l'URL Cloudinary : affichage via
// /api/attachments/:id/view avec le mediaToken du Plan)
export const messageInclude = {
  author: { select: { id: true, pseudo: true } },
  reactions: { include: { user: { select: { id: true, pseudo: true } } } },
  _count: { select: { replies: true } },
  attachment: { select: { id: true, name: true, mimeType: true } },
};
