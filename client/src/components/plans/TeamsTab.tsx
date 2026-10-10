import { useEffect, useState } from 'react';
import { Trophy, Shuffle, Pencil, Check, X, Minus, Plus, ListOrdered, GitBranch, Square } from 'lucide-react';
import { Plan } from '../../types';
import api from '../../services/api';
import { displayName } from '../../lib/names';
import { t } from '../../i18n';

// Tirage des équipes et tournoi (serveur : routes/teams.ts). L'organisateur règle le nombre d'équipes
// et, s'il veut équilibrer, le niveau de chacun (visible par lui seul) ; il peut ensuite déplacer une
// personne, renommer une équipe et lancer un championnat ou une élimination directe.

type Person = { id: string; pseudo: string; firstName?: string | null };
type Team = { id: string; name: string; color: string; members: Person[] };
type Match = { id: string; round: number; position: number; homeId: string | null; awayId: string | null; homeScore: number | null; awayScore: number | null; winnerId: string | null };
type Standing = { teamId: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; diff: number; points: number };
interface TeamsState {
  canManage: boolean; teamCount: number; balanced: boolean; drawn: boolean; format: 'league' | 'knockout' | null;
  participants: (Person & { isLight: boolean; level?: number })[];
  teams: Team[]; myTeamId: string | null; unassigned: Person[];
  matches: Match[]; standings: Standing[]; championId: string | null;
}

const nameOf = (p: Person) => displayName(p) ?? `@${p.pseudo}`;
const card = 'p-4 rounded-2xl bg-white border border-slate-200 shadow-sm';
const LEVELS = ([1, 2, 3] as const).map(v => ({ v, label: t(`games.teams.levels.l${v}`) }));

function roundLabel(format: string, round: number, matchCount: number) {
  if (format === 'league') return t('games.teams.matchday', { n: round });
  if (matchCount === 1) return t('games.teams.final');
  if (matchCount === 2) return t('games.teams.semis');
  if (matchCount === 4) return t('games.teams.quarters');
  if (matchCount === 8) return t('games.teams.eighths');
  return t('games.teams.round', { n: round });
}

export function TeamsTab({ plan, userId }: { plan: Plan; userId: string }) {
  const [s, setS] = useState<TeamsState | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try { setS((await api.get(`/plans/${plan.id}/teams`)).data); }
    catch (err: any) { setError(err.response?.data?.error || t('games.loadError')); }
  }
  useEffect(() => { load(); }, [plan]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); await load(); return true; }
    catch (err: any) { setError(err.response?.data?.error || t('common.retryError')); return false; }
  }

  if (!s) return <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-400">{error}</div>;
  const teamById = new Map(s.teams.map(x => [x.id, x]));
  const myTeam = s.myTeamId ? teamById.get(s.myTeamId) : null;
  const champion = s.championId ? teamById.get(s.championId) : null;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 bg-slate-50 space-y-4 short:flex-none short:overflow-visible">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-800 text-white">
        <p className="text-lg font-bold flex items-center gap-2"><Trophy size={20} /> {t('games.teams.title')}</p>
        <p className="text-sm text-white/85 mt-1">{t('games.teams.intro')}</p>
        {myTeam && (
          <p className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-slate-800 text-sm font-semibold">
            <span className="w-3 h-3 rounded-full" style={{ background: myTeam.color }} /> {t('games.teams.youPlayIn', { name: myTeam.name })}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {champion && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-center">
          <p className="text-4xl">🏆</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{t('games.teams.victory', { name: champion.name })}</p>
          <p className="text-sm text-slate-600 mt-0.5">{champion.members.map(nameOf).join(', ')}</p>
        </div>
      )}

      {s.canManage && <DrawSettings s={s} planId={plan.id} run={run} />}

      {!s.drawn && !s.canManage && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
          {t('games.teams.notDrawn', { count: s.participants.length })}
        </p>
      )}

      {s.drawn && (
        <div className="grid sm:grid-cols-2 gap-3">
          {s.teams.map(x => <TeamCard key={x.id} team={x} s={s} userId={userId} planId={plan.id} run={run} />)}
        </div>
      )}

      {s.canManage && s.unassigned.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          <p className="text-sm font-medium text-amber-800">{t('games.teams.unassigned')}</p>
          {s.unassigned.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-slate-700">{nameOf(p)}</span>
              <MoveSelect teams={s.teams} value="" onChange={teamId => run(() => api.put(`/plans/${plan.id}/teams/move`, { userId: p.id, teamId }))} />
            </div>
          ))}
        </div>
      )}

      {s.drawn && s.teams.length >= 2 && <Tournament s={s} teamById={teamById} planId={plan.id} run={run} />}
    </div>
  );
}

function DrawSettings({ s, planId, run }: { s: TeamsState; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(!s.drawn);
  const save = (body: object) => run(() => api.put(`/plans/${planId}/teams`, body));
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">{t('games.teams.settings')}</button>
        <button onClick={() => { if (confirm(s.format ? t('games.teams.redrawTournament') : t('games.teams.redrawConfirm'))) run(() => api.post(`/plans/${planId}/teams/draw`)); }}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Shuffle size={15} /> {t('games.teams.redraw')}</button>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-2xl bg-white border border-indigo-200 space-y-3">
      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{t('games.teams.drawTitle')}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{t('games.teams.teamCount')}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => save({ teamCount: Math.max(2, s.teamCount - 1) })} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center" aria-label={t('games.teams.less')}><Minus size={15} /></button>
          <span className="w-6 text-center font-semibold">{s.teamCount}</span>
          <button onClick={() => save({ teamCount: Math.min(8, s.teamCount + 1) })} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center" aria-label={t('games.teams.more')}><Plus size={15} /></button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={s.balanced} onChange={e => save({ balanced: e.target.checked })} className="accent-indigo-600 w-4 h-4" />
        {t('games.teams.balance')}
      </label>
      {s.balanced && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">{t('games.teams.onlyYou')}</p>
          {s.participants.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-slate-700">{nameOf(p)}</span>
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                {LEVELS.map(l => (
                  <button key={l.v} onClick={() => save({ levels: { [p.id]: l.v } })}
                    className={`px-2 py-1 rounded-md text-xs ${p.level === l.v ? 'bg-white text-indigo-600 font-semibold shadow-sm' : 'text-slate-500'}`}>{l.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-500">{t('games.teams.participants', { count: s.participants.length })}</p>
      <button
        disabled={s.participants.length < 2}
        onClick={async () => { if (s.drawn && s.format && !confirm(t('games.teams.redrawTournament'))) return; if (await run(() => api.post(`/plans/${planId}/teams/draw`))) setOpen(false); }}
        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-40"
      >
        <Shuffle size={18} /> {s.drawn ? t('games.teams.redraw') : t('games.teams.draw')}
      </button>
      {s.drawn && <button onClick={() => setOpen(false)} className="w-full text-sm text-slate-500">{t('games.teams.closeSettings')}</button>}
    </div>
  );
}

function TeamCard({ team, s, userId, planId, run }: { team: Team; s: TeamsState; userId: string; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1.5" style={{ background: team.color }} />
      <div className="p-3">
        {renaming ? (
          <div className="flex items-center gap-1.5 mb-2">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={30} autoFocus className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 text-sm" />
            <button onClick={async () => { if (await run(() => api.put(`/plans/${planId}/teams/team/${team.id}`, { name }))) setRenaming(false); }} className="p-1.5 text-emerald-600"><Check size={16} /></button>
            <button onClick={() => { setRenaming(false); setName(team.name); }} className="p-1.5 text-slate-400"><X size={16} /></button>
          </div>
        ) : (
          <p className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full" style={{ background: team.color }} />
            {team.name} <span className="text-xs font-normal text-slate-400">{team.members.length}</span>
            {s.canManage && <button onClick={() => setRenaming(true)} className="ml-auto text-slate-300 hover:text-slate-600" title={t('games.teams.rename')}><Pencil size={13} /></button>}
          </p>
        )}
        <ul className="space-y-1">
          {team.members.map(m => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className={`flex-1 truncate ${m.id === userId ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>{nameOf(m)}{m.id === userId ? t('games.teams.you') : ''}</span>
              {s.canManage && <MoveSelect teams={s.teams.filter(x => x.id !== team.id)} value="" onChange={teamId => run(() => api.put(`/plans/${planId}/teams/move`, { userId: m.id, teamId }))} />}
            </li>
          ))}
          {!team.members.length && <li className="text-xs text-slate-400">{t('games.teams.nobody')}</li>}
        </ul>
      </div>
    </div>
  );
}

function MoveSelect({ teams, value, onChange }: { teams: Team[]; value: string; onChange: (teamId: string) => void }) {
  return (
    <select value={value} onChange={e => e.target.value && onChange(e.target.value)} aria-label={t('games.teams.changeTeam')}
      className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 text-slate-500 bg-white max-w-[7.5rem]">
      <option value="">{t('games.teams.move')}</option>
      {teams.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  );
}

function Tournament({ s, teamById, planId, run }: { s: TeamsState; teamById: Map<string, Team>; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  if (!s.format) {
    if (!s.canManage) return null;
    return (
      <div className={card}>
        <p className="font-semibold text-slate-800">{t('games.teams.startTournament')}</p>
        <p className="text-sm text-slate-500 mt-0.5">{t('games.teams.scoresHint')}</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          <button onClick={() => run(() => api.post(`/plans/${planId}/teams/tournament`, { format: 'league' }))} className="p-3 rounded-xl border border-slate-200 text-left hover:bg-slate-50">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5"><ListOrdered size={16} /> {t('games.teams.league')}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{t('games.teams.leagueHint')}</span>
          </button>
          <button onClick={() => run(() => api.post(`/plans/${planId}/teams/tournament`, { format: 'knockout' }))} className="p-3 rounded-xl border border-slate-200 text-left hover:bg-slate-50">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5"><GitBranch size={16} /> {t('games.teams.knockout')}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{t('games.teams.knockoutHint')}</span>
          </button>
        </div>
      </div>
    );
  }

  const rounds = [...new Set(s.matches.map(m => m.round))].sort((a, b) => a - b);
  const team = (id: string | null) => (id ? teamById.get(id) : undefined);

  return (
    <div className="space-y-3">
      {s.format === 'league' && s.standings.length > 0 && (
        <div className={card}>
          <p className="font-semibold text-slate-800 mb-2">{t('games.teams.standings')}</p>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-400"><th className="text-left font-medium pb-1">{t('games.teams.colTeam')}</th><th className="font-medium">{t('games.teams.colPlayed')}</th><th className="font-medium">{t('games.teams.colWon')}</th><th className="font-medium">{t('games.teams.colDrawn')}</th><th className="font-medium">{t('games.teams.colLost')}</th><th className="font-medium">{t('games.teams.colDiff')}</th><th className="font-medium">{t('games.teams.colPoints')}</th></tr></thead>
            <tbody>
              {s.standings.map((st, i) => {
                const tm = team(st.teamId);
                return (
                  <tr key={st.teamId} className="border-t border-slate-100 text-center">
                    <td className="text-left py-1.5"><span className="inline-flex items-center gap-1.5"><span className="text-slate-400 w-4">{i + 1}</span><span className="w-2.5 h-2.5 rounded-full" style={{ background: tm?.color }} />{tm?.name}</span></td>
                    <td>{st.played}</td><td>{st.won}</td><td>{st.drawn}</td><td>{st.lost}</td><td>{st.diff > 0 ? `+${st.diff}` : st.diff}</td><td className="font-bold">{st.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rounds.map(r => {
        const ms = s.matches.filter(m => m.round === r);
        return (
          <div key={r} className={card}>
            <p className="font-semibold text-slate-800 mb-2">{roundLabel(s.format!, r, ms.length)}</p>
            <div className="space-y-2">
              {ms.map(m => <MatchRow key={m.id} m={m} home={team(m.homeId)} away={team(m.awayId)} knockout={s.format === 'knockout'} canEdit={s.canManage} planId={planId} run={run} />)}
            </div>
          </div>
        );
      })}

      {s.canManage && (
        <button onClick={() => { if (confirm(t('games.teams.stopConfirm'))) run(() => api.delete(`/plans/${planId}/teams/tournament`)); }}
          className="text-sm text-slate-500 flex items-center gap-1.5 hover:text-red-600"><Square size={14} /> {t('games.teams.stop')}</button>
      )}
    </div>
  );
}

function MatchRow({ m, home, away, knockout, canEdit, planId, run }: { m: Match; home?: Team; away?: Team; knockout: boolean; canEdit: boolean; planId: string; run: (a: () => Promise<unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [hs, setHs] = useState(m.homeScore?.toString() ?? '');
  const [as, setAs] = useState(m.awayScore?.toString() ?? '');
  const [winner, setWinner] = useState<string | null>(m.winnerId);
  const side = (t?: Team, right = false) => (
    <span className={`flex-1 min-w-0 flex items-center gap-1.5 ${right ? 'justify-end text-right' : ''} ${m.winnerId && t && m.winnerId === t.id ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
      {!right && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t?.color }} />}
      <span className="truncate">{t?.name ?? '—'}</span>
      {right && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t?.color }} />}
    </span>
  );

  if (!m.awayId) {
    return <div className="flex items-center gap-2 text-sm text-slate-500">{side(home)}<span className="text-xs italic">{t('games.teams.bye')}</span></div>;
  }
  const tie = hs !== '' && as !== '' && hs === as;

  if (editing) {
    return (
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          {side(home)}
          <input value={hs} onChange={e => setHs(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-12 text-center px-1 py-1 rounded-lg border border-slate-300" aria-label={t('games.teams.homeScore')} />
          <span className="text-slate-400">–</span>
          <input value={as} onChange={e => setAs(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-12 text-center px-1 py-1 rounded-lg border border-slate-300" aria-label={t('games.teams.awayScore')} />
          {side(away, true)}
        </div>
        {knockout && tie && (
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            {t('games.teams.tieWho')}
            {[home, away].map(x => x && (
              <button key={x.id} onClick={() => setWinner(x.id)} className={`px-2 py-1 rounded-lg border ${winner === x.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'}`}>{x.name}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          {m.homeScore != null && <button onClick={async () => { if (await run(() => api.put(`/plans/${planId}/teams/matches/${m.id}`, { clear: true }))) setEditing(false); }} className="px-2 py-1 text-xs text-slate-500 mr-auto">{t('games.teams.clearScore')}</button>}
          <button onClick={() => setEditing(false)} className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm">{t('common.cancel')}</button>
          <button
            disabled={hs === '' || as === ''}
            onClick={async () => { if (await run(() => api.put(`/plans/${planId}/teams/matches/${m.id}`, { homeScore: Number(hs), awayScore: Number(as), winnerId: tie ? winner : undefined }))) setEditing(false); }}
            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">{t('common.ok')}</button>
        </div>
      </div>
    );
  }

  return (
    <button disabled={!canEdit} onClick={() => setEditing(true)} className={`w-full flex items-center gap-2 text-sm p-2 rounded-xl ${canEdit ? 'hover:bg-slate-50' : ''}`}>
      {side(home)}
      <span className={`px-2 py-0.5 rounded-lg font-semibold tabular-nums ${m.homeScore != null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
        {m.homeScore != null ? `${m.homeScore} – ${m.awayScore}` : canEdit ? t('games.teams.score') : t('games.teams.toPlay')}
      </span>
      {side(away, true)}
    </button>
  );
}
