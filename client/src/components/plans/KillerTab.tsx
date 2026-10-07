import { useEffect, useState } from 'react';
import { Crosshair, Play, Eye, EyeOff, Target, UserPlus, Flag, RotateCcw, X, Trophy, Skull } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';

// Killer (serveur : routes/killer.ts). Avant le début : règles, joueurs, objets et lieux (organisateur).
// Pendant : ma mission (cachée par défaut), « J'ai eu ma cible », confirmation par la cible, joueurs en
// jeu. À la fin : vainqueur et palmarès (qui a éliminé qui).

type Person = { id: string; pseudo: string; firstName?: string | null };
interface KillerState {
  started: boolean; ended: boolean; canManage: boolean;
  objects: string[] | null; places: string[] | null;
  participants: Person[];
  aliveCount: number; playerCount: number;
  players: { user: Person; alive: boolean; eliminatedAt: string | null; kills?: number; eliminatedBy?: Person | null }[];
  me: { alive: boolean; kills: number; mission: { target: Person; object: string; place: string } | null; claimed: boolean; eliminatedBy: Person | null } | null;
  pendingClaim: { killer: Person | null } | null;
  winner: Person | null;
  newcomers: Person[];
}

const nameOf = (p?: Person | null) => (p ? displayName(p) ?? `@${p.pseudo}` : 'Quelqu’un');
const card = 'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm';
const fmtTime = (iso: string) => new Intl.DateTimeFormat('fr-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function KillerTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<KillerState | null>(null);
  const [error, setError] = useState('');
  const [showMission, setShowMission] = useState(false);

  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/killer`)).data); }
    catch (err: any) { setError(err.response?.data?.error || 'Erreur de chargement'); }
  }
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); await load(); return true; }
    catch (err: any) { setError(err.response?.data?.error || 'Erreur, réessaie dans un instant'); return false; }
  }

  if (!s) return <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-400">{error}</div>;
  const running = s.started && !s.ended;
  const isParticipant = s.participants.some(p => p.id === userId);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-red-700 text-white">
        <p className="text-lg font-bold flex items-center gap-2"><Crosshair size={20} /> Killer</p>
        <p className="text-sm text-white/85 mt-1">
          Chacun reçoit en secret une cible, un objet et un lieu. Fais-lui tenir l’objet à cet endroit, sans éveiller ses soupçons. Le dernier en jeu gagne.
        </p>
        {s.started && (
          <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-white/20">{s.ended ? 'Partie terminée' : `${s.aliveCount} en jeu sur ${s.playerCount}`}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Fin de partie */}
      {s.ended && (
        <div className={card}>
          <p className="text-center text-4xl">🏆</p>
          <p className="text-center text-lg font-bold text-slate-900 mt-1">{s.winner ? `${nameOf(s.winner)} remporte la partie !` : 'Partie terminée'}</p>
          <p className="font-semibold text-slate-800 mt-4 mb-2">Palmarès</p>
          <ul className="space-y-1.5">
            {s.players.map(p => (
              <li key={p.user.id} className="text-sm flex items-center gap-2">
                <span className={`font-medium ${p.alive ? 'text-emerald-700' : 'text-slate-700'}`}>{nameOf(p.user)}</span>
                <span className="text-xs text-slate-500">
                  {p.kills ? `🎯 ${p.kills} élimination${p.kills > 1 ? 's' : ''}` : '0 élimination'}
                  {!p.alive && (p.eliminatedBy ? ` · eu(e) par ${nameOf(p.eliminatedBy)}` : ' · a quitté la partie')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* On dit m'avoir éliminé(e) */}
      {running && s.pendingClaim && (
        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-300">
          <p className="font-semibold text-red-800">🔪 {nameOf(s.pendingClaim.killer)} dit t’avoir éliminé(e)</p>
          <p className="text-sm text-red-700 mt-1">Tu as tenu l’objet de sa mission à l’endroit prévu ? Sois beau joueur 😉</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/killer/answer`, { confirm: true }))} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">Oui, je suis éliminé(e)</button>
            <button onClick={() => run(() => api.post(`/plans/${plan.id}/killer/answer`, { confirm: false }))} className="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100">Non, je conteste</button>
          </div>
        </div>
      )}

      {/* Ma mission */}
      {running && s.me?.alive && s.me.mission && (
        showMission ? (
          <div className={card}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-500">Ta mission secrète</p>
              <button onClick={() => setShowMission(false)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><EyeOff size={13} /> Cacher</button>
            </div>
            <div className="mt-2 space-y-2">
              <p className="text-sm"><span className="text-slate-500">Cible :</span> <span className="text-xl font-bold text-slate-900">{nameOf(s.me.mission.target)}</span></p>
              <p className="text-sm"><span className="text-slate-500">Lui faire tenir :</span> <span className="font-semibold text-slate-800">{s.me.mission.object}</span></p>
              <p className="text-sm"><span className="text-slate-500">Où :</span> <span className="font-semibold text-slate-800">{s.me.mission.place}</span></p>
            </div>
            {s.me.claimed ? (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center justify-between gap-2">
                <span>En attente de la confirmation de {nameOf(s.me.mission.target)}…</span>
                <button onClick={() => run(() => api.delete(`/plans/${plan.id}/killer/claim`))} className="text-xs underline flex-shrink-0">Annuler</button>
              </div>
            ) : (
              <button onClick={() => run(() => api.post(`/plans/${plan.id}/killer/claim`))} className="mt-3 w-full py-3 rounded-xl bg-red-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-700">
                <Target size={18} /> J’ai eu ma cible
              </button>
            )}
            {s.me.kills > 0 && <p className="text-xs text-slate-400 mt-2">Tes éliminations : {s.me.kills}</p>}
          </div>
        ) : (
          <button onClick={() => setShowMission(true)} className="w-full p-6 rounded-2xl bg-white border-2 border-dashed border-red-300 text-center hover:bg-red-50 transition-colors">
            <span className="block text-5xl">🕵️</span>
            <span className="block mt-2 font-semibold text-slate-800 flex items-center justify-center gap-1.5"><Eye size={16} /> Voir ma mission</span>
            <span className="block text-xs text-slate-400 mt-1">Assure-toi que personne ne regarde ton écran</span>
          </button>
        )
      )}

      {running && s.me && !s.me.alive && (
        <div className={card}>
          <p className="font-semibold text-slate-800 flex items-center gap-2"><Skull size={18} /> {s.me.eliminatedBy ? `Tu as été éliminé(e) par ${nameOf(s.me.eliminatedBy)}` : 'Tu ne fais plus partie de la partie'}</p>
          <p className="text-sm text-slate-500 mt-1">{s.me.kills ? `Tu as fait ${s.me.kills} élimination${s.me.kills > 1 ? 's' : ''}. ` : ''}Suis la fin de la partie ici… et garde le silence sur les missions que tu connais !</p>
        </div>
      )}

      {running && !s.me && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
          La partie est en cours sans toi. {isParticipant ? 'Demande à l’organisateur de t’ajouter.' : 'Réponds « Je suis in » puis demande à l’organisateur de t’ajouter.'}
        </p>
      )}

      {/* Avant le début */}
      {!s.started && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">Comment ça marche</p>
          <ol className="text-sm text-slate-600 space-y-1.5 list-decimal pl-5">
            <li>L’organisateur lance la partie : chaque joueur reçoit une mission secrète.</li>
            <li>Ta mission : faire tenir un objet à ta cible, à un endroit précis, sans qu’elle se méfie.</li>
            <li>Réussi ? Touche « J’ai eu ma cible ». Ta cible confirme, et tu reprends sa mission.</li>
            <li>Le dernier joueur en jeu gagne. Qui a eu qui est révélé à la fin.</li>
          </ol>
          <p className="text-sm text-slate-700 mt-3">
            <strong>{s.participants.length}</strong> joueur{s.participants.length > 1 ? 's' : ''} pour l’instant (« Je suis in », avec un compte)
            {s.participants.length > 0 && <span className="text-slate-500"> : {s.participants.map(nameOf).join(', ')}</span>}
          </p>
          {!isParticipant && <p className="text-xs text-slate-400 mt-1">Réponds « Je suis in » pour jouer.</p>}
        </div>
      )}

      {/* Joueurs pendant la partie */}
      {running && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">Joueurs</p>
          <ul className="space-y-1">
            {[...s.players].sort((a, b) => +b.alive - +a.alive).map(p => (
              <li key={p.user.id} className="text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.alive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className={p.alive ? 'text-slate-800' : 'text-slate-400 line-through'}>{nameOf(p.user)}</span>
                {!p.alive && p.eliminatedAt && <span className="text-xs text-slate-400">{fmtTime(p.eliminatedAt)}</span>}
                {s.canManage && p.alive && (
                  <button onClick={() => { if (confirm(`Retirer ${nameOf(p.user)} de la partie ? Sa mission passe à la personne qui le visait.`)) run(() => api.post(`/plans/${plan.id}/killer/remove`, { userId: p.user.id })); }}
                    className="ml-auto text-slate-300 hover:text-red-500" title="Retirer de la partie"><X size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.canManage && <ManagerPanel s={s} planId={plan.id} run={run} />}
    </div>
  );
}

function ManagerPanel({ s, planId, run }: { s: KillerState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [objects, setObjects] = useState((s.objects ?? []).join('\n'));
  const [places, setPlaces] = useState((s.places ?? []).join('\n'));
  const [editing, setEditing] = useState(false);
  const lines = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean);
  const running = s.started && !s.ended;

  return (
    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Organisation</p>

      {!s.started && (
        <>
          {editing ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Objets (un par ligne)</label>
              <textarea value={objects} onChange={e => setObjects(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              <label className="block text-sm font-medium text-slate-700">Lieux (un par ligne)</label>
              <textarea value={places} onChange={e => setPlaces(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm">Annuler</button>
                <button onClick={async () => { if (await run(() => api.put(`/plans/${planId}/killer`, { objects: lines(objects), places: lines(places) }))) setEditing(false); }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium">Enregistrer</button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              <p><span className="font-medium text-slate-700">{s.objects?.length} objets</span> : {s.objects?.slice(0, 4).join(', ')}{(s.objects?.length ?? 0) > 4 ? '…' : ''}</p>
              <p className="mt-1"><span className="font-medium text-slate-700">{s.places?.length} lieux</span> : {s.places?.slice(0, 4).join(', ')}{(s.places?.length ?? 0) > 4 ? '…' : ''}</p>
              <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 font-medium mt-1 hover:underline">Adapter à ta soirée</button>
            </div>
          )}
          <button
            disabled={s.participants.length < 3}
            onClick={() => { if (confirm('Lancer la partie ? Chaque joueur reçoit sa mission secrète.')) run(() => api.post(`/plans/${planId}/killer/start`)); }}
            className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40"
          >
            <Play size={18} /> Lancer la partie
          </button>
          {s.participants.length < 3 && <p className="text-xs text-slate-400 text-center">Il faut au moins 3 joueurs.</p>}
        </>
      )}

      {running && s.newcomers.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">Arrivés après le début : {s.newcomers.map(nameOf).join(', ')}</p>
          <button onClick={() => run(() => api.post(`/plans/${planId}/killer/add`))} className="mt-2 text-sm font-medium text-amber-900 flex items-center gap-1.5 hover:underline"><UserPlus size={15} /> Les ajouter à la partie</button>
        </div>
      )}

      {running && (
        <button onClick={() => { if (confirm('Terminer la partie maintenant ? Tout le monde découvre le palmarès.')) run(() => api.post(`/plans/${planId}/killer/end`)); }}
          className="text-sm text-slate-600 flex items-center gap-1.5 hover:text-slate-800"><Flag size={15} /> Terminer la partie</button>
      )}
      {s.started && (
        <button onClick={() => { if (confirm('Tout recommencer ? Les missions et éliminations sont effacées.')) run(() => api.post(`/plans/${planId}/killer/reset`)); }}
          className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-red-600"><RotateCcw size={15} /> {s.ended ? 'Rejouer une partie' : 'Recommencer'}</button>
      )}
      {s.ended && s.winner && <p className="text-xs text-slate-400 flex items-center gap-1"><Trophy size={12} /> Partie gagnée par {nameOf(s.winner)}</p>}
    </div>
  );
}
