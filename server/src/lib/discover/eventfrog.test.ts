import { describe, it, expect } from 'vitest';
import { categoryOf, normalizeEventfrogEvent, pickLang } from './eventfrog';

const parentOf = new Map([[165, 914], [154, 914], [90, 909], [1220, 902], [4, 902], [47, 906], [79, 908], [149, 914]]);
const from = new Date('2026-10-26T00:00:00Z'), to = new Date('2026-11-25T00:00:00Z');
const ev = {
  id: '7449843502832161753', rubricId: 79, title: { de: 'Rock im Keller', fr: null }, url: 'https://eventfrog.ch/de/p/x-7449843502832161753.html',
  begin: '2026-11-07T20:00:00+01:00', end: '2026-11-07T23:30:00+01:00', cancelled: false, visible: true, published: true,
  agendaEntryOnly: false, soldOut: false, lowestTicketPrice: 25, locationIds: ['1'], locationAlias: { fr: null },
};
const loc = { name: 'Salle du Lac', city: 'Nyon', lat: 46.38, lon: 6.24, at: 0 };

describe('Eventfrog', () => {
  it('catégories : sous-catégorie précise, sinon le thème parent', () => {
    expect(categoryOf(165, parentOf).category).toBe('danse');   // Latino, salsa & bachata
    expect(categoryOf(154, parentOf).category).toBe('soiree');  // Electronic / EDM → Soirées & Fêtes
    expect(categoryOf(1220, parentOf).category).toBe('jeux');   // Quiz
    expect(categoryOf(149, parentOf).category).toBe('bar');     // Afterwork
    expect(categoryOf(4, parentOf).category).toBe('animation');
    expect(categoryOf(47, parentOf)).toEqual({ category: 'famille', family: true });
    expect(categoryOf(99999, parentOf).category).toBe('animation');
  });
  it('langue : le français d’abord, sinon celle de l’organisateur', () => {
    expect(pickLang({ de: 'Konzert', fr: 'Concert' })).toBe('Concert');
    expect(pickLang({ de: 'Konzert', fr: null })).toBe('Konzert');
    expect(pickLang(null)).toBeNull();
  });
  it('événement : titre, lieu, prix, statut, lien', () => {
    const e = normalizeEventfrogEvent(ev, loc, parentOf, from, to)!;
    expect(e).toMatchObject({ externalId: ev.id, title: 'Rock im Keller', place: 'Salle du Lac', city: 'Nyon', latitude: 46.38, category: 'concert', priceText: 'CHF 25.00', status: 'scheduled', multiDay: false, url: ev.url });
    expect(normalizeEventfrogEvent({ ...ev, soldOut: true }, loc, parentOf, from, to)?.status).toBe('full');
    expect(normalizeEventfrogEvent({ ...ev, cancelled: true }, loc, parentOf, from, to)?.status).toBe('cancelled');
    expect(normalizeEventfrogEvent({ ...ev, agendaEntryOnly: true }, loc, parentOf, from, to)?.priceText).toBeNull();
  });
  it('écarte ce qui n’est pas public ou hors de la fenêtre ; exposition longue = plusieurs jours', () => {
    expect(normalizeEventfrogEvent({ ...ev, visible: false }, loc, parentOf, from, to)).toBeNull();
    expect(normalizeEventfrogEvent({ ...ev, begin: '2027-01-10T20:00:00+01:00', end: null }, loc, parentOf, from, to)).toBeNull();
    const expo = normalizeEventfrogEvent({ ...ev, rubricId: 90, begin: '2026-07-19T00:00:00+02:00', end: '2027-06-27T00:00:00+02:00' }, loc, parentOf, from, to)!;
    expect(expo).toMatchObject({ category: 'expo', multiDay: true });
  });
});
