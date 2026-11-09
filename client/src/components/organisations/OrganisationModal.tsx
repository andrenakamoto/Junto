import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Copy, LogIn } from 'lucide-react';
import { Modal } from '../ui/Modal';
import api from '../../services/api';
import { t } from '../../i18n';
import { compareOrgCircles, ORG_MATRIX_ACTIONS } from '../../lib/organisations';

interface OrgRole { id: string; name: string; kind: 'direction' | 'responsible' | 'member'; permissions: string[] }
interface OrgCircle { id: string; name: string; code: string; color: string | null; orgKind: 'unit' | 'team' | 'auto'; orgPosition: number; createdAt: string; isMember: boolean; _count: { members: number } }
interface OrgView { id: string; name: string; unitLabel: string | null; teamLabel: string | null; fixedOrder: boolean; isAdmin: boolean; canIntegrate: boolean; roles: OrgRole[]; circles: OrgCircle[] }
interface CircleMemberRow { userId: string; orgRoleId: string | null; orgIntegrated: boolean; user: { pseudo: string; firstName: string | null } }
interface PersonRow { userId: string; isAdmin: boolean; isDirection: boolean; user: { pseudo: string; firstName: string | null } }

const personName = (u: { pseudo: string; firstName: string | null }) => (u.firstName ? `${u.firstName} (@${u.pseudo})` : `@${u.pseudo}`);

// Vue d'ensemble d'une Organisation : direction et administrateurs
export function OrganisationModal({ organisationId, onClose }: { organisationId: string; onClose: () => void }) {
  const [view, setView] = useState<OrgView | null>(null);
  const [tab, setTab] = useState<'circles' | 'rights' | 'people'>('circles');
  const [error, setError] = useState('');
  const load = useCallback(() => api.get(`/organisations/${organisationId}`).then(r => setView(r.data)).catch(e => setError(e.response?.data?.error ?? t('common.error'))), [organisationId]);
  useEffect(() => { load(); }, [load]);
  const fail = (e: any) => setError(e.response?.data?.error ?? t('common.error'));

  async function togglePermission(role: OrgRole, action: string) {
    const permissions = role.permissions.includes(action) ? role.permissions.filter(p => p !== action) : [...role.permissions, action];
    setView(v => v && { ...v, roles: v.roles.map(r => (r.id === role.id ? { ...r, permissions } : r)) });
    await api.put(`/organisations/${organisationId}/roles/${role.id}`, { permissions }).catch(e => { fail(e); load(); });
  }

  const ordered = view ? [...view.circles].sort(compareOrgCircles) : [];
  const kindLabel = (kind: OrgCircle['orgKind']) => (kind === 'unit' ? view?.unitLabel || t('org.words.units') : kind === 'team' ? view?.teamLabel || t('org.words.teams') : t('org.words.auto'));

  async function setFixedOrder(fixedOrder: boolean) {
    setView(v => v && { ...v, fixedOrder });
    await api.put(`/organisations/${organisationId}/order`, { fixedOrder }).catch(e => { fail(e); load(); });
  }
  async function move(index: number, delta: number) {
    const ids = ordered.map(c => c.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    setView(v => v && { ...v, circles: v.circles.map(c => ({ ...c, orgPosition: ids.indexOf(c.id) + 1 })) });
    await api.put(`/organisations/${organisationId}/circles-order`, { circleIds: ids }).catch(e => { fail(e); load(); });
  }

  const tabs = view?.isAdmin ? (['circles', 'rights', 'people'] as const) : (['circles'] as const);
  const tabLabel = { circles: t('org.manage.tabCircles'), rights: t('org.manage.tabRights'), people: t('org.manage.tabPeople') };
  const sections = view ? ([
    ['unit', view.unitLabel || t('org.words.units')], ['auto', t('org.words.auto')], ['team', view.teamLabel || t('org.words.teams')],
  ] as const) : [];

  return (
    <Modal title={view?.name ?? t('org.manage.title')} onClose={onClose} wide>
      {tabs.length > 1 && (
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {tabs.map(x => (
            <button key={x} onClick={() => setTab(x)} className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === x ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tabLabel[x]}</button>
          ))}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {view && tab === 'circles' && (
        <div className="space-y-4">
          {view.canIntegrate && <p className="text-xs text-slate-500">{t('org.manage.integrateNote')}</p>}
          {view.isAdmin && (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" checked={view.fixedOrder} onChange={e => setFixedOrder(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
              <span><span className="block text-sm font-medium text-slate-800">{t('org.manage.fixedOrder')}</span><span className="block text-xs text-slate-500">{t('org.manage.fixedOrderHint')}</span></span>
            </label>
          )}
          {view.fixedOrder && (
            <div className="space-y-1.5">
              {ordered.map((c, i) => (
                <CircleRow key={c.id} org={view} circle={c} onChanged={load} onError={fail} kindLabel={kindLabel(c.orgKind)}
                  onUp={view.isAdmin && i > 0 ? () => move(i, -1) : undefined} onDown={view.isAdmin && i < ordered.length - 1 ? () => move(i, 1) : undefined} canMove={view.isAdmin} />
              ))}
            </div>
          )}
          {!view.fixedOrder && sections.map(([kind, label]) => {
            const list = view.circles.filter(c => c.orgKind === kind);
            if (!list.length) return null;
            return (
              <section key={kind}>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</h3>
                <div className="space-y-1.5">{list.map(c => <CircleRow key={c.id} org={view} circle={c} onChanged={load} onError={fail} />)}</div>
              </section>
            );
          })}
        </div>
      )}
      {view && tab === 'rights' && (
        <div>
          <p className="text-xs text-slate-500 mb-3">{t('org.manage.rightsHelp')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left font-semibold text-slate-600 py-2 pr-3">{t('org.manage.rightsAction')}</th>
                {view.roles.map(r => <th key={r.id} className="font-semibold text-slate-700 py-2 px-2 text-center whitespace-nowrap">{r.name}</th>)}
              </tr></thead>
              <tbody>
                {ORG_MATRIX_ACTIONS.map(action => (
                  <tr key={action} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">{t(`org.manage.actions.${action}`)}</td>
                    {view.roles.map(r => (
                      <td key={r.id} className="py-2 px-2 text-center">
                        <input type="checkbox" checked={r.permissions.includes(action)} aria-label={`${t(`org.manage.actions.${action}`)} : ${r.name}`} onChange={() => togglePermission(r, action)} className="w-4 h-4 accent-indigo-600" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view && tab === 'people' && <PeopleTab organisationId={organisationId} onError={fail} />}
    </Modal>
  );
}

function CircleRow({ org, circle, onChanged, onError, kindLabel, onUp, onDown, canMove }: { org: OrgView; circle: OrgCircle; onChanged: () => void; onError: (e: any) => void; kindLabel?: string; onUp?: () => void; onDown?: () => void; canMove?: boolean }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<CircleMemberRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const roles = org.roles.filter(r => r.kind !== 'direction');
  const load = useCallback(() => api.get(`/organisations/${org.id}/circles/${circle.id}/members`).then(r => setMembers(r.data)).catch(onError), [org.id, circle.id]);
  useEffect(() => { if (open) load(); }, [open, load]);

  async function integrate() {
    await api.post(`/organisations/${org.id}/circles/${circle.id}/integrate`).then(onChanged).catch(onError);
  }
  async function setRole(userId: string, roleId: string) {
    await api.put(`/organisations/${org.id}/circles/${circle.id}/members/${userId}/role`, { roleId }).then(() => { load(); onChanged(); }).catch(onError);
  }
  function copy() {
    navigator.clipboard?.writeText(circle.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 p-2.5">
        {canMove && (
          <span className="flex flex-col flex-shrink-0">
            <button onClick={onUp} disabled={!onUp} title={t('org.manage.moveUp')} aria-label={`${t('org.manage.moveUp')} : ${circle.name}`} className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowUp size={14} /></button>
            <button onClick={onDown} disabled={!onDown} title={t('org.manage.moveDown')} aria-label={`${t('org.manage.moveDown')} : ${circle.name}`} className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-25"><ArrowDown size={14} /></button>
          </span>
        )}
        <button onClick={() => setOpen(v => !v)} aria-expanded={open} title={open ? t('org.manage.hideMembers') : t('org.manage.showMembers')} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open ? <ChevronDown size={15} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />}
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: circle.color ?? '#94a3b8' }} />
          <span className="min-w-0"><span className="block text-sm font-medium text-slate-800 truncate">{circle.name}</span><span className="block text-xs text-slate-500">{kindLabel ? `${kindLabel} · ` : ''}{t('org.manage.members', { count: circle._count.members })}</span></span>
        </button>
        {circle.orgKind !== 'auto' && (
          <button onClick={copy} title={t('org.manage.copyCode')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-slate-600 hover:bg-slate-100">
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}{circle.code}
          </button>
        )}
        {circle.isMember
          ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 px-2"><Check size={13} />{t('org.manage.integrated')}</span>
          : org.canIntegrate && <button onClick={integrate} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"><LogIn size={13} />{t('org.manage.integrate')}</button>}
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t border-slate-100 pt-2">
          {members?.length === 0 && <p className="text-sm text-slate-400 italic">{t('org.manage.noMember')}</p>}
          {members?.map(m => {
            const role = org.roles.find(r => r.id === m.orgRoleId);
            return (
              <div key={m.userId} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{personName(m.user)}</span>
                {circle.orgKind === 'team' && role?.kind !== 'direction'
                  ? <select value={m.orgRoleId ?? ''} aria-label={t('org.manage.role')} onChange={e => setRole(m.userId, e.target.value)} className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs text-slate-800">
                      {!m.orgRoleId && <option value="" />}
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  : <span className="text-xs text-slate-500">{role?.name ?? ''}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PeopleTab({ organisationId, onError }: { organisationId: string; onError: (e: any) => void }) {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const load = useCallback(() => api.get(`/organisations/${organisationId}/people`).then(r => setPeople(r.data)).catch(onError), [organisationId]);
  useEffect(() => { load(); }, [load]);
  const toggle = (p: PersonRow) => api.put(`/organisations/${organisationId}/members/${p.userId}/direction`, { isDirection: !p.isDirection }).then(load).catch(onError);
  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">{t('org.manage.peopleHelp')}</p>
      <div className="space-y-1">
        {people.map(p => (
          <div key={p.userId} className="flex items-center gap-2 py-1.5 border-b border-slate-100">
            <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{personName(p.user)}</span>
            {p.isAdmin
              ? <span className="text-xs font-medium text-slate-500">{t('org.manage.admin')}</span>
              : <button onClick={() => toggle(p)} className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${p.isDirection ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50'}`}>{p.isDirection ? t('org.manage.removeDirection') : t('org.manage.makeDirection')}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Réglages d'un Cercle d'Organisation : quels rôles de membres écrivent dans la Discussion
export function DiscussionRolesField({ organisationId, circleId, readOnly }: { organisationId: string; circleId: string; readOnly?: boolean }) {
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    api.get(`/organisations/${organisationId}/circles/${circleId}/discussion`).then(r => { setRoles(r.data.roles); setSelected(r.data.roleIds); }).catch(() => {});
  }, [organisationId, circleId]);
  async function toggle(id: string) {
    const roleIds = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(roleIds);
    await api.put(`/organisations/${organisationId}/circles/${circleId}/discussion`, { roleIds }).catch(() => setSelected(selected));
  }
  if (!roles.length) return null;
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{t('org.discussion.title')}</p>
      <p className="text-xs text-slate-500 mb-1.5">{t('org.discussion.help')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {roles.map(r => (
          <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={selected.includes(r.id)} disabled={readOnly} onChange={() => toggle(r.id)} className="accent-indigo-600" />{r.name}
          </label>
        ))}
      </div>
    </div>
  );
}
