import { describe, expect, it } from 'vitest';
import { audienceAllows, audienceExcludedIds, autoMemberIds, canWriteOrgDiscussion, isManagerKind, parseActions, parseAudience, parseOrganisationInput, permissionsOf } from './organisations';

const scouts = () => ({
  name: 'Scouts de Carouge',
  roles: [
    { ref: 'dir', name: 'Dirigeant', kind: 'direction', permissions: ['integrate_all', 'create_plan'] },
    { ref: 'chef', name: 'Chef', kind: 'responsible', permissions: ['create_plan'] },
    { ref: 'parent', name: 'Parent', kind: 'member', permissions: [] },
  ],
  circles: [
    { ref: 'tres', name: 'Trésorerie', kind: 'unit', extraPermissions: ['see_money'] },
    { ref: 'orange', name: 'Orange', kind: 'team', defaultRoleRef: 'parent', discussionRoleRefs: ['parent'] },
    { ref: 'chefs', name: 'Chefs', kind: 'auto', autoRoleRefs: ['chef'], autoCircleRefs: ['tres'] },
  ],
});

describe('parseOrganisationInput', () => {
  it('accepte une structure complète', () => {
    const r = parseOrganisationInput(scouts());
    expect('input' in r && r.input.circles.map(c => c.kind)).toEqual(['unit', 'team', 'auto']);
  });
  it('refuse sans rôle de direction, ou avec deux', () => {
    const none = scouts(); none.roles.shift();
    expect('error' in parseOrganisationInput(none)).toBe(true);
    const two = scouts(); two.roles[1].kind = 'direction';
    expect('error' in parseOrganisationInput(two)).toBe(true);
  });
  it('refuse une équipe sans rôle de membre', () => {
    const s: any = scouts(); s.circles[1].defaultRoleRef = 'chef';
    expect('error' in parseOrganisationInput(s)).toBe(true);
  });
  it('refuse un Cercle automatique qui cite autre chose qu’une unité', () => {
    const s: any = scouts(); s.circles[2].autoCircleRefs = ['orange'];
    expect('error' in parseOrganisationInput(s)).toBe(true);
  });
  it('refuse un objet à la place d’un nom', () => {
    expect('error' in parseOrganisationInput({ ...scouts(), name: { not: '' } })).toBe(true);
  });
  it('ignore les droits inconnus', () => {
    expect(parseActions(['create_plan', 'tout_faire', 3])).toEqual(['create_plan']);
  });
  it('ne garde des droits ajoutés que sur les unités', () => {
    const s: any = scouts(); s.circles[1].extraPermissions = ['see_money'];
    const r = parseOrganisationInput(s);
    expect('input' in r && r.input.circles[1].extraPermissions).toEqual([]);
  });
});

describe('autoMemberIds', () => {
  const facts = {
    directionIds: ['marie'],
    assignments: [{ userId: 'paul', roleId: 'chef' }, { userId: 'sophie', roleId: 'parent' }, { userId: 'x', roleId: null }],
    circleMembers: new Map([['tres', ['marie', 'luc']]]),
  };
  it('réunit les chefs et les membres des unités citées, sans doublon', () => {
    expect([...autoMemberIds({ autoDirection: false, autoRoleIds: ['chef'], autoCircleIds: ['tres'] }, facts)].sort()).toEqual(['luc', 'marie', 'paul']);
  });
  it('« Tous les dirigeants » suit la direction', () => {
    expect([...autoMemberIds({ autoDirection: true, autoRoleIds: [], autoCircleIds: [] }, facts)]).toEqual(['marie']);
  });
});

describe('droits', () => {
  it('additionne rôle, direction et unités', () => {
    expect([...permissionsOf({ rolePermissions: ['a'], directionPermissions: ['b'], unitPermissions: [['c'], ['a']] })].sort()).toEqual(['a', 'b', 'c']);
  });
  it('un membre sans rôle n’a aucun droit', () => {
    expect(permissionsOf({}).size).toBe(0);
  });
  it('direction et responsables gèrent le Cercle, pas les membres', () => {
    expect([isManagerKind('direction'), isManagerKind('responsible'), isManagerKind('member'), isManagerKind(null)]).toEqual([true, true, false, false]);
  });
});

describe('canWriteOrgDiscussion', () => {
  it('suit le réglage par rôle', () => {
    expect(canWriteOrgDiscussion('open', false, 'parent', ['parent'])).toBe(true);
    expect(canWriteOrgDiscussion('open', false, 'jeune', ['parent'])).toBe(false);
    expect(canWriteOrgDiscussion('open', false, null, ['parent'])).toBe(false);
  });
  it('les responsables écrivent toujours, sauf discussion coupée', () => {
    expect(canWriteOrgDiscussion('announce', true, null, [])).toBe(true);
    expect(canWriteOrgDiscussion('off', true, null, [])).toBe(false);
    expect(canWriteOrgDiscussion('announce', false, 'parent', ['parent'])).toBe(false);
  });
});

describe('Pour qui ?', () => {
  const m = (userId: string, circleKind: string, roleId: string | null, roleKind: string | null) => ({ userId, circleKind, roleId, roleKind });
  it('sans rôle visé, tout le Cercle est concerné', () => {
    expect(audienceAllows([m('a', 'team', 'parent', 'member')], [])).toBe(true);
  });
  it('dans une équipe, seuls les rôles visés', () => {
    expect(audienceAllows([m('a', 'team', 'parent', 'member')], ['chef'])).toBe(false);
    expect(audienceAllows([m('a', 'team', 'chef', 'responsible')], ['chef'])).toBe(true);
  });
  it('une personne Parent ici et Chef là-bas est retenue', () => {
    expect(audienceAllows([m('a', 'team', 'parent', 'member'), m('a', 'team', 'chef', 'responsible')], ['chef'])).toBe(true);
  });
  it('une unité visée entre entière, la direction garde la vue', () => {
    expect(audienceAllows([m('a', 'unit', null, null)], ['chef'])).toBe(true);
    expect(audienceAllows([m('a', 'team', 'dir', 'direction')], ['chef'])).toBe(true);
  });
  it('le créateur n’est jamais exclu', () => {
    expect(audienceExcludedIds([m('moi', 'team', 'parent', 'member'), m('b', 'team', 'parent', 'member')], ['chef'], 'moi')).toEqual(['b']);
  });
  it('refuse une audience mal formée', () => {
    expect(parseAudience({ circleIds: [] })).toBeNull();
    expect(parseAudience({ circleIds: [{ not: '' }] })).toBeNull();
    expect(parseAudience({ circleIds: ['a', 'a'], roleIds: ['r'] })).toEqual({ circleIds: ['a'], roleIds: ['r'] });
  });
});
