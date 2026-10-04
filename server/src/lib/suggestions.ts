import { resend, FROM_EMAIL, APP_URL } from './mailer';

// « Proposer une amélioration » (menu ☰). Envoi : routes/suggestions.ts ; suivi : panneau admin
// (routes/admin.ts). Pas de capture d'écran (choix de l'utilisateur, 2026-10-04).

export const SUGGESTION_KINDS = ['idea', 'bug', 'other'] as const;
export const SUGGESTION_STATUSES = ['new', 'review', 'planned', 'done', 'declined'] as const;
export const SUGGESTION_MAX = 1000;
export const SUGGESTION_REPLY_MAX = 500;
// Au plus 5 suggestions par personne sur 24 heures
export const SUGGESTIONS_PER_DAY = 5;
// Statuts qui préviennent la personne (notification dans l'app + push)
export const NOTIFIED_STATUSES = ['planned', 'done'];

const KIND_LABELS: Record<string, string> = { idea: '💡 Idée', bug: '🐞 Problème', other: '💬 Autre' };
const PLATFORM_LABELS: Record<string, string> = { web: 'site', android: 'app Android', ios: 'app iPhone' };

export function isSuggestionKind(v: unknown): v is typeof SUGGESTION_KINDS[number] {
  return typeof v === 'string' && (SUGGESTION_KINDS as readonly string[]).includes(v);
}

export function isSuggestionStatus(v: unknown): v is typeof SUGGESTION_STATUSES[number] {
  return typeof v === 'string' && (SUGGESTION_STATUSES as readonly string[]).includes(v);
}

// Une seule adresse, comme pour les signalements
const SUGGESTIONS_EMAIL = process.env.REPORTS_EMAIL || 'info@evly.ch';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export async function emailNewSuggestion(s: { kind: string; content: string; platform: string | null; appVersion: string | null }, pseudo: string) {
  const where = [s.platform && PLATFORM_LABELS[s.platform], s.appVersion && `version ${s.appVersion}`].filter(Boolean).join(', ');
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to: SUGGESTIONS_EMAIL,
    subject: `Nouvelle suggestion sur EvLY (${KIND_LABELS[s.kind] ?? s.kind})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>${KIND_LABELS[s.kind] ?? 'Suggestion'} de @${escapeHtml(pseudo)}</h2>
        ${where ? `<p style="color:#64748b;font-size:13px">Depuis le ${escapeHtml(where)}</p>` : ''}
        <p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px">${escapeHtml(s.content)}</p>
        <a href="${APP_URL}/admin" style="display:inline-block;padding:12px 24px;background:#ea5a2b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Ouvrir le panneau admin
        </a>
      </div>`,
  });
  if (r.error) console.error('[suggestion email]', r.error);
}
