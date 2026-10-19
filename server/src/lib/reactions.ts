// Réactions possibles dans tous les chats (Plans, sondages de dates, discussions des Cercles) :
// même liste que REACTION_EMOJIS de client/src/lib/reactions.ts
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥', '👏', '😍', '🤔', '😅', '👌', '💪', '🥳', '✅'] as const;

const ALLOWED = new Set<string>(REACTION_EMOJIS);
export const isAllowedReaction = (emoji: unknown): emoji is string => typeof emoji === 'string' && ALLOWED.has(emoji);
