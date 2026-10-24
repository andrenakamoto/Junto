import { useState, useEffect } from 'react';
import { Copy, Check, Send, MessageSquare, ExternalLink, QrCode, Mail, Share2, Users, UserPlus, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { publicOrigin } from '../../lib/siteUrl';
import { t, currentLang } from '../../i18n';
import { Trans } from 'react-i18next';
import { Contact } from '../../types';
import { Avatar } from '../ui/Avatar';

interface Props {
  /** Nom du Cercle */
  circleName: string;
  circleCode: string;
  /** Id du Cercle : permet d'inviter directement un compte EvLY existant (pseudo ou email) */
  circleId?: string;
  /** Si on invite à un Plan spécifique */
  planTitle?: string;
  /** Id du Plan, pour rediriger directement dessus après avoir rejoint le Cercle */
  planId?: string;
  /** Propose aussi d'inviter une personne extérieure au Cercle, avec accès à ce seul Plan */
  allowGuest?: boolean;
  /** Faux pour un invité externe : il ne doit jamais voir le code du Cercle */
  canInviteToCircle?: boolean;
  /** Le créateur du Plan peut régénérer le lien externe */
  isPlanCreator?: boolean;
  /** Règle du Plan « Qui invite des personnes extérieures » : faux = pas de lien du Plan pour cette personne */
  canInviteGuests?: boolean;
  /** Admission du Cercle (open, creator, vote) : rappelée à la personne qui invite */
  admissionMode?: string;
  onClose: () => void;
}

type Mode = 'circle' | 'guest';

export function InviteModal({ circleName, circleCode, circleId, planTitle, planId, allowGuest = false, canInviteToCircle = true, isPlanCreator = false, canInviteGuests = true, admissionMode, onClose }: Props) {
  // Depuis un Plan : d'abord le lien du Plan (s'il est permis), sinon l'invitation par le Cercle
  const guestAllowed = allowGuest && canInviteGuests;
  const [mode, setMode] = useState<Mode>(guestAllowed ? 'guest' : canInviteToCircle ? 'circle' : 'guest');
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestError, setGuestError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Toujours une adresse evly.ch : dans les apps, l'origine locale (localhost) ne marche pas hors de l'app
  const appUrl = publicOrigin();

  // Le code suffit (le nom du Cercle peut changer) ; titre et id du Plan pour une invitation à un Plan
  // lang : aperçu du lien (image, texte) dans la langue de la personne qui invite
  const circleLink = `${appUrl}/rejoindre?code=${circleCode}${planId ? `&planId=${planId}` : ''}${planTitle ? `&plan=${encodeURIComponent(planTitle)}` : ''}&lang=${currentLang()}`;
  const guestLink = guestToken ? `${appUrl}/invitation?token=${guestToken}` : '';
  const isGuestMode = mode === 'guest';
  const joinLink = isGuestMode ? guestLink : circleLink;

  useEffect(() => {
    if (!isGuestMode || guestToken || !planId || !guestAllowed) return;
    api.post(`/plans/${planId}/guest-link`)
      .then(res => setGuestToken(res.data.token))
      .catch(err => setGuestError(err.response?.data?.error || t('circle.invite.linkError')));
  }, [isGuestMode, guestToken, planId, guestAllowed]);

  async function resetGuestLink() {
    if (!planId) return;
    setResetting(true);
    try {
      const { data } = await api.post(`/plans/${planId}/guest-link/reset`);
      setGuestToken(data.token);
    } catch (err: any) {
      setGuestError(err.response?.data?.error || t('common.error'));
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    if (!showQr || !joinLink) return;
    QRCode.toDataURL(joinLink, { width: 240, margin: 1, color: { dark: '#431a11', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [showQr, joinLink]);

  const smsText = isGuestMode
    ? t('circle.invite.planGuestText', { plan: planTitle, link: joinLink })
    : planTitle
    ? t('circle.invite.planCircleText', { plan: planTitle, circle: circleName, code: circleCode, link: joinLink })
    : t('circle.invite.circleText', { circle: circleName, code: circleCode, link: joinLink });

  const shareMessage = isGuestMode || planTitle
    ? t('circle.invite.planShareTitle', { plan: planTitle })
    : t('circle.invite.circleShareTitle', { circle: circleName });
  const canShare = typeof navigator !== 'undefined' && !!(navigator as any).share;

  useEffect(() => {
    api.get('/invitations/status').then(res => setTwilioEnabled(res.data.twilioEnabled)).catch(() => {});
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function openSmsApp() {
    window.location.href = `sms:?body=${encodeURIComponent(smsText)}`;
  }

  function openWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(smsText)}`, '_blank');
  }

  async function handleNativeShare() {
    try {
      await (navigator as any).share({ title, text: shareMessage, url: joinLink });
    } catch { /* utilisateur a annulé, ou non supporté */ }
  }

  async function sendViaTwilio() {
    if (!phone.trim()) return;
    setSending(true);
    setError('');
    try {
      // Le serveur fabrique lui-même le texte et le lien (routes/invitations.ts)
      await api.post('/invitations/sms', { to: phone.trim(), circleId, planId, guest: isGuestMode });
      setSent(true);
      setPhone('');
      setTimeout(() => setSent(false), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('circle.invite.sendError'));
    } finally {
      setSending(false);
    }
  }

  async function sendViaEmail() {
    if (!email.trim()) return;
    setSendingEmail(true);
    setEmailError('');
    try {
      await api.post('/invitations/email', { to: email.trim(), circleId, planId, guest: isGuestMode });
      setEmailSent(true);
      setEmail('');
      setTimeout(() => setEmailSent(false), 4000);
    } catch (err: any) {
      setEmailError(err.response?.data?.error || t('circle.invite.sendError'));
    } finally {
      setSendingEmail(false);
    }
  }

  const title = planTitle ? t('circle.invite.titlePlan', { plan: planTitle }) : t('circle.invite.titleCircle', { circle: circleName });

  // Personne extérieure au Cercle qui n'a pas le droit d'inviter : rien à partager, seulement l'explication
  if (!guestAllowed && !canInviteToCircle) {
    return (
      <Modal title={title} onClose={onClose}>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 leading-relaxed">{t('circle.invite.guestsReserved')}</p>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-5">

        {/* Depuis un Plan : le lien du Plan (n'importe qui, sans entrer dans le Cercle) ou l'invitation par le Cercle */}
        {guestAllowed && canInviteToCircle && (
          <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('guest'); setShowQr(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'guest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserPlus size={13} />
              {t('circle.invite.tabPlan')}
            </button>
            <button
              onClick={() => { setMode('circle'); setShowQr(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'circle' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={13} />
              {t('circle.invite.tabCircle')}
            </button>
          </div>
        )}
        {allowGuest && !canInviteGuests && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">{t('circle.invite.guestsReserved')}</p>
        )}

        {/* Context */}
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          {isGuestMode ? (
            <Trans i18nKey="circle.invite.guestHint" components={{ b: <strong className="text-slate-700" /> }} />
          ) : planTitle ? (
            <Trans i18nKey="circle.invite.viaCircleHint" values={{ circle: circleName, code: circleCode }} components={{ b: <strong className="text-slate-700" />, c: <span className="font-mono font-bold text-slate-700" /> }} />
          ) : (
            <Trans i18nKey="circle.invite.codeHint" values={{ circle: circleName, code: circleCode }} components={{ b: <strong className="text-slate-700" />, c: <span className="font-mono font-bold text-slate-700" /> }} />
          )}
          {/* Rappel de la règle d'admission du Cercle */}
          {!isGuestMode && (admissionMode === 'creator' || admissionMode === 'vote' || admissionMode === 'open') && (
            <span className="block mt-1 text-slate-600">{t(`circle.invite.admission.${admissionMode}`)}</span>
          )}
        </div>

        {/* Compte EvLY existant : invitation directe, la personne accepte ou refuse dans l'app */}
        {/* (invitation au Cercle : seulement depuis le Cercle, pas depuis un Plan) */}
        {!isGuestMode && circleId && !planId && <MemberInvite circleId={circleId} />}

        {/* Copy link */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('circle.invite.link')}</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinLink}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono truncate focus:outline-none"
            />
            <button
              onClick={copyLink}
              disabled={!joinLink}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('circle.invite.copied') : t('circle.invite.copy')}
            </button>
            <button
              onClick={() => setShowQr(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                showQr ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <QrCode size={14} />
            </button>
          </div>
          {isGuestMode && guestError && <p className="text-xs text-red-500 mt-1.5">{guestError}</p>}
          {isGuestMode && isPlanCreator && guestToken && (
            <button
              onClick={resetGuestLink}
              disabled={resetting}
              className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={11} className={resetting ? 'animate-spin' : ''} />
              {t('circle.invite.newLink')}
            </button>
          )}
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={t('circle.invite.qrAlt')} className="w-40 h-40" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">{t('circle.invite.generating')}</div>
              )}
              <p className="text-xs text-slate-400 text-center">{t('circle.invite.scan')}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* Share section */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('circle.invite.share')}</p>
          <div className="flex gap-2">
            {canShare && (
              <button
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Share2 size={14} />
                {t('circle.invite.share')}
              </button>
            )}
            <button
              onClick={openWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#1fb855] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <MessageSquare size={14} />
              WhatsApp
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Email section (invitation au Cercle uniquement : le modèle d'email contient le code) */}
        {!isGuestMode && <>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('circle.invite.byEmail')}</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('circle.invite.emailPlaceholder')}
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={e => e.key === 'Enter' && sendViaEmail()}
              />
              <button
                onClick={sendViaEmail}
                disabled={sendingEmail || !email.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {sendingEmail ? '...' : <><Mail size={14} />{t('common.send')}</>}
              </button>
            </div>
            {emailSent && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                <Check size={12} />{t('circle.invite.emailSent')}
              </p>
            )}
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
          </div>
        </div>

        <div className="border-t border-slate-100" />
        </>}

        {/* SMS section */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('circle.invite.bySms')}</p>

          {/* Message preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-slate-500 mb-1 font-medium">{t('circle.invite.smsPreview')}</p>
            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{smsText}</p>
          </div>

          {twilioEnabled ? (
            /* Twilio sending */
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('circle.invite.phonePlaceholder')}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={e => e.key === 'Enter' && sendViaTwilio()}
                />
                <button
                  onClick={sendViaTwilio}
                  disabled={sending || !phone.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {sending ? '...' : <><Send size={14} />{t('common.send')}</>}
                </button>
              </div>
              {sent && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <Check size={12} />{t('circle.invite.smsSent')}
                </p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          ) : (
            /* Fallback: open native SMS app */
            <div className="space-y-2">
              <button
                onClick={openSmsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <MessageSquare size={16} />
                {t('circle.invite.openSms')}
                <ExternalLink size={13} className="opacity-70" />
              </button>
              <p className="text-xs text-slate-400 text-center">
                {t('circle.invite.prefilled')}
              </p>
              <p className="text-xs text-slate-400 text-center">
                <Trans i18nKey="circle.invite.twilio" components={{ c: <code className="text-slate-500" /> }} />
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MemberInvite({ circleId }: { circleId: string }) {
  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  async function invite() {
    if (!identifier.trim() || sending) return;
    setSending(true);
    setError('');
    setDone('');
    try {
      const { data } = await api.post(`/circles/${circleId}/invitations`, { identifier: identifier.trim() });
      setDone(t('circle.invite.invitedUser', { pseudo: data.pseudo }));
      setIdentifier('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('circle.invite.retry'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('circle.invite.alreadyOn')}</p>
      <div className="flex gap-2">
        <input
          value={identifier}
          onChange={e => { setIdentifier(e.target.value); setDone(''); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && invite()}
          placeholder={t('circle.invite.userPlaceholder')}
          autoCapitalize="none"
          autoCorrect="off"
          className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={invite}
          disabled={!identifier.trim() || sending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
        >
          <UserPlus size={14} />
          {sending ? '…' : t('circle.invite.invite')}
        </button>
      </div>
      {done && <p className="text-xs text-emerald-600 mt-1.5">{done}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      <ContactPicker circleId={circleId} />
    </div>
  );
}

const foldText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// « Parmi mes contacts » : les membres de mes autres Cercles qui ne sont pas encore dans celui-ci, à cocher,
// puis une invitation par personne (même route que la saisie d'un pseudo)
function ContactPicker({ circleId }: { circleId: string }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/contacts', { params: { circleId } }).then(res => setContacts(res.data)).catch(() => setContacts([]));
  }, [circleId]);

  if (!contacts || contacts.length === 0) return null;
  const q = foldText(query.trim());
  const shown = q ? contacts.filter(c => foldText(`${c.firstName ?? ''} ${c.pseudo}`).includes(q)) : contacts;

  function toggle(id: string) {
    setSent(0);
    setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function inviteAll() {
    setSending(true);
    setError('');
    let ok = 0;
    for (const c of contacts!.filter(x => picked.has(x.id))) {
      try {
        await api.post(`/circles/${circleId}/invitations`, { identifier: c.pseudo });
        ok++;
        setContacts(prev => prev!.map(x => (x.id === c.id ? { ...x, invited: true } : x)));
      } catch (err: any) {
        setError(err.response?.data?.error || t('circle.invite.retry'));
        break;
      }
    }
    setPicked(new Set());
    setSent(ok);
    setSending(false);
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-800">{t('circle.contacts.pick')}</p>
      <p className="text-xs text-slate-400 mb-2">{t('circle.contacts.pickHint')}</p>
      {contacts.length >= 6 && (
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('circle.contacts.search')}
          className="w-full mb-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}
      <div className="max-h-56 overflow-y-auto space-y-1 -mx-1 px-1">
        {shown.map(c => (
          <label key={c.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${c.invited ? 'opacity-60' : 'hover:bg-slate-50 cursor-pointer'}`}>
            <input type="checkbox" disabled={c.invited} checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="rounded" />
            <Avatar pseudo={c.pseudo} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-slate-800 truncate">{c.firstName || `@${c.pseudo}`}</span>
              <span className="block text-[11px] text-slate-400 truncate">{c.invited ? t('circle.contacts.alreadyInvited') : c.circles.map(x => x.name).join(' · ')}</span>
            </span>
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">{t('circle.contacts.noMatch')}</p>}
      </div>
      {picked.size > 0 && (
        <button
          onClick={inviteAll}
          disabled={sending}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <UserPlus size={14} />
          {sending ? '…' : t('circle.contacts.inviteSelected', { count: picked.size })}
        </button>
      )}
      {sent > 0 && <p className="text-xs text-emerald-600 mt-1.5">{t('circle.contacts.sentCount', { count: sent })}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
