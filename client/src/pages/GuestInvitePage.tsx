import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CalendarDays, ArrowRight, Loader2, MapPin, Users, Check, HelpCircle, X, MessageSquare, Car, Image, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LogoIcon } from '../components/ui/Logo';
import { TermsModal } from '../components/ui/TermsModal';
import { savePendingInvite, clearPendingInvite } from '../lib/pendingInvite';
import { getLightToken, setLightToken, clearLightToken } from '../lib/lightGuest';

type Rsvp = 'in' | 'maybe' | 'out';

// Personne connectée : aperçu court, puis « Rejoindre ce Plan » (/api/plans/guest-invite)
interface InvitePreview {
  planId: string;
  title: string;
  eventDate: string | null;
  creatorPseudo: string;
  alreadyMember: boolean;
  full: boolean;
}

// Personne sans compte : aperçu complet et réponse en un clic (/api/invite, serveur lib/lightGuest.ts)
interface PublicPreview {
  planId: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  endDate: string;
  location: string | null;
  creatorName: string;
  counts: { in: number; maybe: number };
  full: boolean;
  me: { firstName: string | null; rsvp: Rsvp } | null;
  participants?: { name: string; rsvp: Rsvp; isMe: boolean }[];
}

const RSVP_OPTIONS: { value: Rsvp; label: string; icon: typeof Check; active: string; idle: string }[] = [
  { value: 'in', label: 'Je suis in', icon: Check, active: 'bg-emerald-500 border-emerald-500 text-white', idle: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' },
  { value: 'maybe', label: 'Peut-être', icon: HelpCircle, active: 'bg-amber-500 border-amber-500 text-white', idle: 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' },
  { value: 'out', label: 'Je passe', icon: X, active: 'bg-slate-500 border-slate-500 text-white', idle: 'border-slate-600 text-slate-300 hover:bg-slate-700/40' },
];

const CONFIRMATION: Record<Rsvp, string> = {
  in: 'Tu es in ! Les autres participants sont prévenus.',
  maybe: 'C\'est noté : peut-être. Tu peux changer d\'avis à tout moment ici.',
  out: 'C\'est noté : tu ne viens pas. Merci d\'avoir répondu !',
};

function formatDate(iso: string | null) {
  return iso
    ? new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    : null;
}

export function GuestInvitePage() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const token = params.get('token') ?? '';

  if (loading) return null;
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md py-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <LogoIcon size={64} />
          </div>
          <h1 className="text-2xl font-black text-white">Tu es invité(e) !</h1>
        </div>
        {user ? <MemberInvite token={token} /> : <AnonymousInvite token={token} />}
      </div>
    </div>
  );
}

// ─── Sans compte ──────────────────────────────────────────────────────────────

function AnonymousInvite({ token }: { token: string }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<PublicPreview | null>(null);
  const [error, setError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [sending, setSending] = useState<Rsvp | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);

  const lightHeaders = () => {
    const t = getLightToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  useEffect(() => {
    if (!token) { setError("Ce lien d'invitation est incomplet."); return; }
    api.get(`/invite/${token}`, { headers: lightHeaders() })
      .then(res => setPreview(res.data))
      .catch(err => setError(err.response?.data?.error || "Ce lien d'invitation n'est plus valide"));
  }, [token]);

  async function answer(rsvp: Rsvp) {
    if (!preview || sending) return;
    setSending(rsvp);
    setError('');
    try {
      const { data } = await api.post(`/invite/${token}/respond`, { rsvp, firstName }, { headers: lightHeaders() });
      setLightToken(data.lightToken);
      setPreview(data);
      setJustAnswered(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur, réessaie dans un instant');
    } finally {
      setSending(null);
    }
  }

  async function removeAnswer() {
    if (!confirm('Retirer ta réponse ? Ton prénom sera effacé de ce Plan.')) return;
    try {
      const { data } = await api.delete(`/invite/${token}/respond`, { headers: lightHeaders() });
      if (data.accountDeleted) clearLightToken();
      const res = await api.get(`/invite/${token}`, { headers: lightHeaders() });
      setPreview(res.data);
      setJustAnswered(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    }
  }

  // Inscription / connexion : on revient ici ensuite, et les réponses passent sur le compte
  function goAuth(register: boolean) {
    savePendingInvite(token);
    const q = new URLSearchParams({ redirect: `/invitation?token=${token}` });
    if (register) {
      q.set('mode', 'inscription');
      const name = preview?.me?.firstName ?? firstName;
      if (name) q.set('prenom', name);
    }
    navigate(`/auth?${q.toString()}`);
  }

  if (!preview) {
    return (
      <Card>
        {error
          ? <ErrorBox text={error} />
          : <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-slate-400" /></div>}
        {error && <Link to="/auth" className="block text-center text-sm text-slate-400 hover:text-slate-200">Aller sur EvLY</Link>}
      </Card>
    );
  }

  const me = preview.me;
  return (
    <div className="space-y-4">
      <Card>
        <PlanSummary preview={preview} />

        {me ? (
          <>
            {justAnswered && (
              <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                {CONFIRMATION[me.rsvp]}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Ta réponse{me.firstName ? `, ${me.firstName}` : ''}
              </p>
              <RsvpButtons value={me.rsvp} sending={sending} onChoose={answer} disabledIn={preview.full && me.rsvp === 'out'} />
            </div>
            {preview.participants && preview.participants.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Qui vient</p>
                <ul className="flex flex-wrap gap-1.5">
                  {preview.participants.map((p, i) => (
                    <li key={i} className={`text-xs px-2.5 py-1 rounded-full border ${p.rsvp === 'in' ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' : 'border-amber-500/30 text-amber-200 bg-amber-500/10'}`}>
                      {p.name}{p.isMe ? ' (toi)' : ''}{p.rsvp === 'maybe' ? ' · peut-être' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : preview.full ? (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">Ce Plan est complet.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="invite-firstname" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ton prénom</label>
              <input
                id="invite-firstname"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                maxLength={30}
                autoComplete="given-name"
                placeholder="Pour que les autres sachent qui vient"
                className="w-full px-4 py-3 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
            <RsvpButtons value={null} sending={sending} onChoose={answer} disabled={!firstName.trim()} />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pas besoin de compte : seul ton prénom est enregistré, et il est effacé à la fin du Plan. En
              répondant, tu acceptes les{' '}
              <button type="button" onClick={() => setShowTerms(true)} className="underline hover:text-slate-300">conditions d'utilisation</button>
              {' '}et la{' '}
              <Link to="/confidentialite" className="underline hover:text-slate-300">politique de confidentialité</Link>.
            </p>
          </div>
        )}

        {error && <ErrorBox text={error} />}
      </Card>

      {me ? (
        <Card>
          <p className="text-white font-semibold text-sm">Envie d'en profiter pleinement ?</p>
          <ul className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            <li className="flex items-center gap-2"><MessageSquare size={14} className="text-indigo-400" /> Le chat du Plan</li>
            <li className="flex items-center gap-2"><Car size={14} className="text-indigo-400" /> Le covoiturage</li>
            <li className="flex items-center gap-2"><Image size={14} className="text-indigo-400" /> Les photos</li>
            <li className="flex items-center gap-2"><Bell size={14} className="text-indigo-400" /> Les rappels</li>
          </ul>
          <button
            onClick={() => goAuth(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Créer mon compte gratuit en 1 min <ArrowRight size={16} />
          </button>
          <p className="text-center text-xs text-slate-500">
            Ta réponse est gardée.{' '}
            <button onClick={() => goAuth(false)} className="text-slate-300 hover:text-white underline">J'ai déjà un compte</button>
          </p>
          <button onClick={removeAnswer} className="w-full text-[11px] text-slate-500 hover:text-slate-300">
            Retirer ma réponse
          </button>
        </Card>
      ) : (
        <p className="text-center text-sm text-slate-400">
          Déjà un compte EvLY ?{' '}
          <button onClick={() => goAuth(false)} className="text-indigo-300 hover:text-indigo-200 font-medium">Se connecter</button>
        </p>
      )}

      {showTerms && <TermsModal readOnly onClose={() => setShowTerms(false)} />}
    </div>
  );
}

function RsvpButtons({ value, sending, onChoose, disabled, disabledIn }: {
  value: Rsvp | null; sending: Rsvp | null; onChoose: (r: Rsvp) => void; disabled?: boolean; disabledIn?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RSVP_OPTIONS.map(({ value: v, label, icon: Icon, active, idle }) => (
        <button
          key={v}
          onClick={() => v !== value && onChoose(v)}
          disabled={disabled || !!sending || (disabledIn && v !== 'out')}
          aria-pressed={value === v}
          className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${value === v ? active : idle}`}
        >
          {sending === v ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
          {label}
        </button>
      ))}
    </div>
  );
}

function PlanSummary({ preview }: { preview: PublicPreview }) {
  const date = formatDate(preview.eventDate);
  const going = preview.counts.in;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <CalendarDays size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold">{preview.title}</p>
          <p className="text-slate-400 text-xs mt-0.5">Proposé par {preview.creatorName}</p>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        {date && <p className="flex items-center gap-2 text-indigo-200 first-letter:uppercase"><CalendarDays size={14} className="text-indigo-400 flex-shrink-0" /><span className="first-letter:uppercase">{date}</span></p>}
        {preview.location && <p className="flex items-center gap-2 text-slate-300"><MapPin size={14} className="text-indigo-400 flex-shrink-0" />{preview.location}</p>}
        <p className="flex items-center gap-2 text-slate-300">
          <Users size={14} className="text-indigo-400 flex-shrink-0" />
          {going} participant{going > 1 ? 's' : ''}{preview.counts.maybe > 0 ? ` · ${preview.counts.maybe} peut-être` : ''}
        </p>
      </div>
      {preview.description && (
        <p className="text-sm text-slate-300 whitespace-pre-line line-clamp-6 bg-slate-900/50 rounded-xl p-3 border border-slate-700/40">{preview.description}</p>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-slate-700/50 space-y-4">{children}</div>;
}

function ErrorBox({ text }: { text: string }) {
  return <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{text}</p>;
}

// ─── Personne connectée (inchangé) ────────────────────────────────────────────

function MemberInvite({ token }: { token: string }) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) { setError("Ce lien d'invitation est incomplet."); return; }
    api.get(`/plans/guest-invite/${token}`)
      .then(res => setPreview(res.data))
      .catch(err => {
        clearPendingInvite();
        setError(err.response?.data?.error || "Ce lien d'invitation n'est plus valide");
      });
  }, [token]);

  async function handleJoin() {
    if (!preview) return;
    if (preview.alreadyMember) {
      clearPendingInvite();
      navigate(`/dashboard?planId=${preview.planId}`);
      return;
    }
    setJoining(true);
    setError('');
    try {
      const { data } = await api.post(`/plans/guest-invite/${token}/accept`);
      clearPendingInvite();
      navigate(`/dashboard?planId=${data.planId}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setJoining(false);
    }
  }

  function handleIgnore() {
    clearPendingInvite();
    navigate('/dashboard');
  }

  const dateFmt = formatDate(preview?.eventDate ?? null);

  return (
    <Card>
      {!preview && !error && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      )}

      {preview && (
        <div className="flex items-start gap-3 p-4 bg-slate-900/60 rounded-xl border border-slate-700/40">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarDays size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm">{preview.title}</p>
            <p className="text-slate-400 text-xs mt-0.5">Proposé par @{preview.creatorPseudo}</p>
            {dateFmt && <p className="text-indigo-300 text-xs mt-1 first-letter:uppercase">{dateFmt}</p>}
          </div>
        </div>
      )}

      {preview && !preview.alreadyMember && (
        <p className="text-xs text-slate-400 leading-relaxed">
          Tu rejoindras <strong className="text-slate-300">uniquement ce Plan</strong> : son chat, ses infos, les
          trajets et les photos. Rejoindre un Plan, c'est dire oui à ce qui y est proposé.
        </p>
      )}

      {error && <ErrorBox text={error} />}

      {preview && (preview.full && !preview.alreadyMember ? (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Ce Plan est complet.
        </p>
      ) : (
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {joining ? 'Un instant...' : (
            <>
              {preview.alreadyMember ? 'Ouvrir le Plan' : 'Rejoindre ce Plan'}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      ))}

      <button
        onClick={handleIgnore}
        className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        {error ? 'Aller sur EvLY' : 'Ignorer'}
      </button>
    </Card>
  );
}
