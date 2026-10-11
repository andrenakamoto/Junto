import { describe, expect, it } from 'vitest';
import { bringSummary, moneySummary, pendingMatches, rideSummary, unansweredPolls } from './planSummary';

const nico = { id: 'nico', pseudo: 'nico', firstName: 'Nico' };
const lea = { id: 'lea', pseudo: 'lea_m', firstName: null };

describe('rideSummary', () => {
  const rides = [
    { driverId: 'nico', driver: nico, departure: 'Gare', departureAt: new Date('2026-10-20T16:15:00Z'), seats: 3, passengers: [{ userId: 'me' }] },
    { driverId: 'lea', driver: lea, departure: 'Place', departureAt: null, seats: 4, passengers: [] },
  ];
  it('passager', () => expect(rideSummary(rides, [], 'me')).toMatchObject({ role: 'passenger', driver: 'Nico', departure: 'Gare' }));
  it('conducteur : places restantes', () => expect(rideSummary(rides, [], 'nico')).toMatchObject({ role: 'driver', seatsFree: 2, passengers: 1 }));
  it('en recherche', () => expect(rideSummary(rides, [{ userId: 'tom', fromLocation: 'Sion' }], 'tom')).toEqual({ role: 'searching', from: 'Sion' }));
  it('sans trajet : places proposées, la plus grande offre en tête', () =>
    expect(rideSummary(rides, [], 'tom')).toEqual({ role: 'none', offers: [{ driver: 'lea_m', seatsFree: 4 }, { driver: 'Nico', seatsFree: 2 }] }));
  it('rien du tout', () => expect(rideSummary([], [], 'tom')).toBeNull());
});

describe('bringSummary', () => {
  const items = [{ label: 'Chips', quantity: null, claimedBy: 'moi_pseudo' }, { label: 'Vin', quantity: '2 bouteilles', claimedBy: null }, { label: 'Pain', quantity: null, claimedBy: 'tom' }];
  it('ce que j’apporte et ce qui manque', () => expect(bringSummary(items, 'moi_pseudo')).toEqual({ mine: ['Chips'], missing: ['Vin (2 bouteilles)'] }));
  it('liste vide', () => expect(bringSummary([], 'me')).toBeNull());
});

describe('moneySummary', () => {
  const names: Record<string, string> = { me: 'Moi', lea: 'Léa', tom: 'Tom' };
  const byCurrency = [{ currency: 'CHF', transfers: [{ fromUserId: 'me', toUserId: 'lea', amount: 24.499 }, { fromUserId: 'tom', toUserId: 'me', amount: 10 }] }];
  it('dettes et créances, arrondies', () =>
    expect(moneySummary(byCurrency, 'me', id => names[id])).toEqual({ owe: [{ to: 'Léa', amount: 24.5, currency: 'CHF' }], owed: [{ from: 'Tom', amount: 10, currency: 'CHF' }] }));
  it('pas de dépenses', () => expect(moneySummary([], 'me', id => id)).toBeNull());
});

describe('à faire', () => {
  it('sondages sans ma réponse', () =>
    expect(unansweredPolls([{ options: [{ votes: [{ userId: 'me' }] }] }, { options: [{ votes: [{ userId: 'tom' }] }] }], 'me')).toBe(1));
  it('matchs avec des cartes à jouer (pas clos ni échus)', () => {
    const base = { closedAt: null, deadline: null, options: [{ id: 'a' }, { id: 'b' }] };
    expect(pendingMatches([
      { ...base, swipes: [{ optionId: 'a', userId: 'me' }] },
      { ...base, swipes: [{ optionId: 'a', userId: 'me' }, { optionId: 'b', userId: 'me' }] },
      { ...base, closedAt: new Date(), swipes: [] },
      { ...base, deadline: new Date('2020-01-01'), swipes: [] },
    ], 'me')).toBe(1);
  });
});
