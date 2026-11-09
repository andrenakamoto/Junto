import { useEffect, useState } from 'react';
import api from '../../services/api';
import { t } from '../../i18n';

export interface AudienceValue { organisationId: string; circleIds: string[]; roleIds: string[] }
interface Options { organisationId: string; unitLabel: string | null; teamLabel: string | null; circles: { id: string; name: string; color: string | null; orgKind: 'unit' | 'team' | 'auto' }[]; roles: { id: string; name: string }[] }

// Le choix sort-il du Cercle ouvert ? Sinon, le Plan ou le sondage se crée comme d'habitude.
export function audienceIsWide(a: AudienceValue | null, circleId: string): boolean {
  return !!a && (a.circleIds.length !== 1 || a.circleIds[0] !== circleId || a.roleIds.length > 0);
}

const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`;

// « Pour qui ? » : n'apparaît que dans un Cercle d'Organisation, pour une personne qui a le droit de publier
export function AudienceField({ circleId, value, onChange, kind }: { circleId: string; value: AudienceValue | null; onChange: (v: AudienceValue | null) => void; kind: 'plan' | 'poll' }) {
  const [options, setOptions] = useState<Options | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    onChange(null);
    api.get(`/circles/${circleId}`).then(async ({ data }) => {
      const organisationId: string | undefined = data?.organisation?.id;
      if (!organisationId) return;
      const { data: o } = await api.get(`/organisations/${organisationId}/audience`);
      if (!live || !o.circles.length) return;
      setOptions({ ...o, organisationId });
      onChange({ organisationId, circleIds: [circleId], roleIds: [] });
    }).catch(() => {});
    return () => { live = false; };
  }, [circleId]);

  const circleKey = value?.circleIds.join(',');
  const roleKey = value?.roleIds.join(',');
  useEffect(() => {
    if (!value?.circleIds.length) { setCount(null); return; }
    const timer = setTimeout(() => {
      api.post(`/organisations/${value.organisationId}/audience-count`, { circleIds: value.circleIds, roleIds: value.roleIds }).then(r => setCount(r.data.count)).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [circleKey, roleKey]);

  if (!options || !value) return null;
  const everyone = options.circles.map(c => c.id);
  const isAll = everyone.every(id => value.circleIds.includes(id)) && !value.roleIds.length;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const hasTeam = options.circles.some(c => c.orgKind === 'team' && value.circleIds.includes(c.id));
  const sections = [['team', options.teamLabel || t('org.words.teams')], ['unit', options.unitLabel || t('org.words.units')], ['auto', t('org.words.auto')]] as const;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5">
      <p className="text-sm font-semibold text-slate-800">{t('org.audience.title')}</p>
      <button type="button" aria-pressed={isAll} onClick={() => onChange({ ...value, circleIds: isAll ? [circleId] : everyone, roleIds: [] })} className={chip(isAll)}>{t('org.audience.all')}</button>
      {sections.map(([orgKind, label]) => {
        const list = options.circles.filter(c => c.orgKind === orgKind);
        if (!list.length) return null;
        return (
          <div key={orgKind}>
            <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {list.map(c => <button key={c.id} type="button" aria-pressed={value.circleIds.includes(c.id)} onClick={() => onChange({ ...value, circleIds: toggle(value.circleIds, c.id) })} className={chip(value.circleIds.includes(c.id))}>{c.name}</button>)}
            </div>
          </div>
        );
      })}
      {hasTeam && options.roles.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">{t('org.audience.roles')}</p>
          <div className="flex flex-wrap gap-1.5">
            {options.roles.map(r => <button key={r.id} type="button" aria-pressed={value.roleIds.includes(r.id)} onClick={() => onChange({ ...value, roleIds: toggle(value.roleIds, r.id) })} className={chip(value.roleIds.includes(r.id))}>{r.name}</button>)}
          </div>
          {!value.roleIds.length && <p className="text-xs text-slate-500 mt-1">{t('org.audience.rolesHint')}</p>}
        </div>
      )}
      {value.circleIds.length === 0
        ? <p className="text-sm text-red-600">{t('org.audience.none')}</p>
        : count !== null && <p className="text-sm font-medium text-indigo-800">{kind === 'plan' ? t('org.audience.count', { count }) : t('org.audience.pollCount', { count })}</p>}
    </div>
  );
}
