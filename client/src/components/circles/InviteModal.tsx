import { useState, useEffect } from 'react';
import { Copy, Check, Send, MessageSquare, ExternalLink, QrCode, Mail, Share2, Users, UserPlus, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { publicOrigin } from '../../lib/siteUrl';

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
  onClose: () => void;
}

type Mode = 'circle' | 'guest';

export function InviteModal({ circleName, circleCode, circleId, planTitle, planId, allowGuest = false, canInviteToCircle = true, isPlanCreator = false, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(canInviteToCircle ? 'circle' : 'guest');
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
  const circleLink = `${appUrl}/rejoindre?code=${circleCode}${planId ? `&planId=${planId}` : ''}${planTitle ? `&plan=${encodeURIComponent(planTitle)}` : ''}`;
  const guestLink = guestToken ? `${appUrl}/invitation?token=${guestToken}` : '';
  const isGuestMode = mode === 'guest';
  const joinLink = isGuestMode ? guestLink : circleLink;

  useEffect(() => {
    if (!isGuestMode || guestToken || !planId) return;
    api.post(`/plans/${planId}/guest-link`)
      .then(res => setGuestToken(res.data.token))
      .catch(err => setGuestError(err.response?.data?.error || 'Impossible de créer le lien'));
  }, [isGuestMode, guestToken, planId]);

  async function resetGuestLink() {
    if (!planId) return;
    setResetting(true);
    try {
      const { data } = await api.post(`/plans/${planId}/guest-link/reset`);
      setGuestToken(data.token);
    } catch (err: any) {
      setGuestError(err.response?.data?.error || 'Erreur');
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
    ? `Salut ! Je t'invite à mon Plan "${planTitle}" sur EvLY 🎉\nClique ici pour le rejoindre :\n${joinLink}`
    : planTitle
    ? `Salut ! Je t'invite à mon Plan "${planTitle}" sur EvLY 🎉\nRejoins d'abord le Cercle "${circleName}" avec le code ${circleCode} :\n${joinLink}`
    : `Salut ! Rejoins mon Cercle "${circleName}" sur EvLY 🎉\nCode d'accès : ${circleCode}\n${joinLink}`;

  const shareMessage = isGuestMode || planTitle
    ? `Je t'invite à mon Plan "${planTitle}" sur EvLY 🎉`
    : `Rejoins mon Cercle "${circleName}" sur EvLY 🎉`;
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
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi');
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
      setEmailError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSendingEmail(false);
    }
  }

  const title = planTitle ? `Inviter au Plan "${planTitle}"` : `Inviter au Cercle "${circleName}"`;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-5">

        {allowGuest && canInviteToCircle && (
          <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('circle'); setShowQr(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'circle' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={13} />
              Au Cercle
            </button>
            <button
              onClick={() => { setMode('guest'); setShowQr(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'guest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <UserPlus size={13} />
              Personne extérieure
            </button>
          </div>
        )}

        {/* Context */}
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          {isGuestMode ? (
            <>La personne invitée rejoindra <strong className="text-slate-700">uniquement ce Plan</strong> : elle n'aura accès ni au Cercle, ni à ses autres Plans, ni à ses membres.</>
          ) : planTitle ? (
            <>Le destinataire rejoindra le Cercle <strong className="text-slate-700">"{circleName}"</strong> (code : <span className="font-mono font-bold text-slate-700">{circleCode}</span>), puis pourra accéder au Plan.</>
          ) : (
            <>Partage le code <span className="font-mono font-bold text-slate-700">{circleCode}</span> pour inviter quelqu'un dans <strong className="text-slate-700">"{circleName}"</strong>.</>
          )}
        </div>

        {/* Compte EvLY existant : invitation directe, la personne accepte ou refuse dans l'app */}
        {!isGuestMode && circleId && <MemberInvite circleId={circleId} />}

        {/* Copy link */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lien d'invitation</p>
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
              {copied ? 'Copié !' : 'Copier'}
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
              Générer un nouveau lien (l'ancien ne fonctionnera plus)
            </button>
          )}
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code d'invitation" className="w-40 h-40" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">Génération...</div>
              )}
              <p className="text-xs text-slate-400 text-center">À scanner avec l'appareil photo</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100" />

        {/* Share section */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Partager</p>
          <div className="flex gap-2">
            {canShare && (
              <button
                onClick={handleNativeShare}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Share2 size={14} />
                Partager
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
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Envoyer par email</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom@exemple.com"
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={e => e.key === 'Enter' && sendViaEmail()}
              />
              <button
                onClick={sendViaEmail}
                disabled={sendingEmail || !email.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {sendingEmail ? '...' : <><Mail size={14} />Envoyer</>}
              </button>
            </div>
            {emailSent && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                <Check size={12} />Email envoyé avec succès !
              </p>
            )}
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
          </div>
        </div>

        <div className="border-t border-slate-100" />
        </>}

        {/* SMS section */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Envoyer par SMS</p>

          {/* Message preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
            <p className="text-xs text-slate-500 mb-1 font-medium">Message qui sera envoyé :</p>
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
                  placeholder="+33 6 12 34 56 78"
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyDown={e => e.key === 'Enter' && sendViaTwilio()}
                />
                <button
                  onClick={sendViaTwilio}
                  disabled={sending || !phone.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {sending ? '...' : <><Send size={14} />Envoyer</>}
                </button>
              </div>
              {sent && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                  <Check size={12} />SMS envoyé avec succès !
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
                Ouvrir mon application SMS
                <ExternalLink size={13} className="opacity-70" />
              </button>
              <p className="text-xs text-slate-400 text-center">
                Le message est pré-rempli — il te reste à choisir le destinataire.
              </p>
              <p className="text-xs text-slate-400 text-center">
                Pour l'envoi direct, configure Twilio dans <code className="text-slate-500">.env</code>.
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
      setDone(`Invitation envoyée à @${data.pseudo}. Elle pourra l'accepter dans EvLY.`);
      setIdentifier('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur, réessaie');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Déjà sur EvLY ?</p>
      <div className="flex gap-2">
        <input
          value={identifier}
          onChange={e => { setIdentifier(e.target.value); setDone(''); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && invite()}
          placeholder="Son pseudo ou son email"
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
          {sending ? '…' : 'Inviter'}
        </button>
      </div>
      {done && <p className="text-xs text-emerald-600 mt-1.5">{done}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}
