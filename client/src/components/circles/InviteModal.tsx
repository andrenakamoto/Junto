import { useState, useEffect } from 'react';
import { Copy, Check, Send, MessageSquare, ExternalLink, QrCode, Mail } from 'lucide-react';
import QRCode from 'qrcode';
import { Modal } from '../ui/Modal';
import api from '../../services/api';

interface Props {
  /** Nom du Cercle */
  circleName: string;
  circleCode: string;
  /** Si on invite à un Plan spécifique */
  planTitle?: string;
  /** Id du Plan, pour rediriger directement dessus après avoir rejoint le Cercle */
  planId?: string;
  onClose: () => void;
}

export function InviteModal({ circleName, circleCode, planTitle, planId, onClose }: Props) {
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

  const appUrl = window.location.origin;

  const joinLink = `${appUrl}/rejoindre?name=${encodeURIComponent(circleName)}&code=${circleCode}${planTitle ? `&plan=${encodeURIComponent(planTitle)}` : ''}${planId ? `&planId=${planId}` : ''}`;

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(joinLink, { width: 240, margin: 1, color: { dark: '#1e1b4b', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [showQr, joinLink]);

  const smsText = planTitle
    ? `Salut ! Je t'invite à mon Plan "${planTitle}" sur EvLY 🎉\nRejoins d'abord le Cercle "${circleName}" avec le code ${circleCode} :\n${joinLink}`
    : `Salut ! Rejoins mon Cercle "${circleName}" sur EvLY 🎉\nCode d'accès : ${circleCode}\n${joinLink}`;

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

  async function sendViaTwilio() {
    if (!phone.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post('/invitations/sms', { to: phone.trim(), message: smsText });
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
      await api.post('/invitations/email', { to: email.trim(), circleName, circleCode, planTitle, joinLink });
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

        {/* Context */}
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
          {planTitle ? (
            <>Le destinataire rejoindra le Cercle <strong className="text-slate-700">"{circleName}"</strong> (code : <span className="font-mono font-bold text-slate-700">{circleCode}</span>), puis pourra accéder au Plan.</>
          ) : (
            <>Partage le code <span className="font-mono font-bold text-slate-700">{circleCode}</span> pour inviter quelqu'un dans <strong className="text-slate-700">"{circleName}"</strong>.</>
          )}
        </div>

        {/* Copy link */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lien d'invitation</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={joinLink}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono truncate focus:outline-none"
            />
            <button
              onClick={copyLink}
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

        {/* Email section */}
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
