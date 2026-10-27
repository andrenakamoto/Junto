import { describe, expect, it } from 'vitest';
import { delayChanges, moveItem, parseProgramInput, reminderDueFor, scheduleItems } from './program';

const at = (hhmm: string) => new Date(`2026-12-04T${hhmm}:00Z`);
const item = (id: string, durationMin: number, fixedStart: Date | null = null) => ({ id, durationMin, fixedStart });

describe('scheduleItems', () => {
  it('enchaîne les moments depuis le début du Plan', () => {
    const s = scheduleItems([item('accueil', 30), item('discours', 15), item('apero', 45)], at('18:00'));
    expect(s.map(x => x.start?.toISOString().slice(11, 16))).toEqual(['18:00', '18:30', '18:45']);
    expect(s[2].end?.toISOString().slice(11, 16)).toBe('19:30');
  });
  it('une heure fixe repart de là, la suite s’enchaîne après elle', () => {
    const s = scheduleItems([item('accueil', 30), item('repas', 90, at('20:00')), item('quiz', 30)], at('18:00'));
    expect(s.map(x => x.start?.toISOString().slice(11, 16))).toEqual(['18:00', '20:00', '21:30']);
  });
  it('sans début de Plan ni heure fixe : pas d’heure', () => {
    expect(scheduleItems([item('a', 10)], null)[0].start).toBeNull();
  });
});

describe('delayChanges', () => {
  const items = [item('accueil', 30), item('discours', 15), item('repas', 90, at('20:00'))];
  it('« +15 min » sur le moment en cours le prolonge', () => {
    expect(delayChanges(items, 'discours', 15, 'extend', at('18:00'))).toEqual([{ id: 'discours', durationMin: 30 }]);
  });
  it('décaler un moment allonge le précédent, ou avance son heure fixe', () => {
    expect(delayChanges(items, 'discours', 15, 'shift', at('18:00'))).toEqual([{ id: 'accueil', durationMin: 45 }]);
    expect(delayChanges(items, 'repas', 15, 'shift', at('18:00'))).toEqual([{ id: 'repas', fixedStart: at('20:15') }]);
    expect(delayChanges(items, 'accueil', 15, 'shift', at('18:00'))).toEqual([{ id: 'accueil', fixedStart: at('18:15') }]);
    expect(delayChanges(items, 'accueil', 15, 'shift', null)).toBeNull();
  });
});

describe('moveItem / rappels / saisie', () => {
  it('déplace d’un cran, pas au-delà des bords', () => {
    expect(moveItem(['a', 'b', 'c'], 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 'c', 'down')).toEqual(['a', 'b', 'c']);
  });
  it('rappel dans les 10 minutes, une fois par heure de début', () => {
    const now = at('18:52').getTime();
    expect(reminderDueFor({ start: at('19:00'), end: null, remindedStart: null }, now)).toBe(true);
    expect(reminderDueFor({ start: at('19:00'), end: null, remindedStart: at('19:00') }, now)).toBe(false);
    expect(reminderDueFor({ start: at('19:00'), end: null, remindedStart: at('18:45') }, now)).toBe(true);
    expect(reminderDueFor({ start: at('19:15'), end: null, remindedStart: null }, now)).toBe(false);
    expect(reminderDueFor({ start: at('18:50'), end: null, remindedStart: null }, now)).toBe(false);
  });
  it('valide un moment', () => {
    expect(parseProgramInput({ title: ' Discours ', durationMin: 15, assigneeIds: ['a', 'a'] }))
      .toMatchObject({ title: 'Discours', durationMin: 15, fixedStart: null, assigneeIds: ['a'] });
    expect(parseProgramInput({ title: 'X', durationMin: -5 })).toHaveProperty('error');
    expect(parseProgramInput({ title: 'X', fixedStart: { gt: '' } })).toHaveProperty('error');
    expect(parseProgramInput({ title: '' })).toHaveProperty('error');
  });
});
