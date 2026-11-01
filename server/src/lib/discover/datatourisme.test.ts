import { describe, it, expect } from 'vitest';
import { categoryOfTypes, creditOf, normalizeDatatourismeEvent } from './datatourisme';
import { cantonAt, searchLocalities } from './geo';

// Objet réel (forme de l'API DATAtourisme, champs utiles) : marché des créateurs de Gex, deux dates
const MARCHE = {
  uuid: '00a93f26-c042-3', label: { '@fr': 'Marché des créateurs', '@en': 'Artists’ Market' },
  type: ['SaleEvent', 'Event', 'Market', 'PointOfInterest', 'EntertainmentAndEvent'],
  hasBeenCreatedBy: { legalName: 'Office de Tourisme du Pays de Gex', homepage: ['https://www.paysdegex-montsjura.com/'] },
  lastUpdate: '2026-10-09',
  hasContact: [{ homepage: ['https://www.gex.fr/event/marche-des-createurs/'] }],
  isLocatedAt: [{ geo: { latitude: 46.336433, longitude: 6.058837 }, address: [{ streetAddress: ['Avenue Perdtemps'], addressLocality: 'Gex',
    hasAddressCity: { insee: '01173', label: { '@fr': 'Gex' }, isPartOfDepartment: { insee: '01' } } }] }],
  takesPlaceAt: [{ startDate: '2026-11-08', endDate: '2026-11-08', startTime: '10:00', endTime: '18:00' }, { startDate: '2026-11-07', endDate: '2026-11-07', startTime: '10:00', endTime: '19:00' }],
};

describe('DATAtourisme', () => {
  const from = new Date('2026-11-01T00:00:00Z'), to = new Date('2026-12-01T00:00:00Z');
  it('une ligne par date, à l’heure française, dans le département', () => {
    const rows = normalizeDatatourismeEvent(MARCHE, from, to);
    expect(rows).toHaveLength(2);
    expect(rows[0].externalId).toBe('00a93f26-c042-3:2026-11-07');
    expect(rows[0].startAt.toISOString()).toBe('2026-11-07T09:00:00.000Z'); // 10 h à Paris (heure d'hiver)
    expect(rows[0].region).toBe('f01');
    expect(rows[0].city).toBe('Gex');
    expect(rows[0].url).toBe('https://www.gex.fr/event/marche-des-createurs/');
    expect(rows[0].category).toBe('animation');
    expect(rows[0].multiDay).toBe(false);
  });
  it('crédit : auteur et date de mise à jour (licence)', () => {
    expect(creditOf(MARCHE)).toBe('Office de Tourisme du Pays de Gex · DATAtourisme, mise à jour 09.10.2026');
  });
  it('période de plusieurs jours → une seule ligne', () => {
    const expo = { ...MARCHE, uuid: 'x', type: ['Exhibition'], takesPlaceAt: [{ startDate: '2026-11-10', endDate: '2026-11-30' }] };
    const rows = normalizeDatatourismeEvent(expo, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0].multiDay).toBe(true);
    expect(rows[0].category).toBe('expo');
  });
  it('hors période : rien', () => {
    expect(normalizeDatatourismeEvent({ ...MARCHE, takesPlaceAt: [{ startDate: '2027-02-01', endDate: '2027-02-01' }] }, from, to)).toHaveLength(0);
  });
  it('catégories', () => {
    expect(categoryOfTypes(['CulturalEvent', 'MusicEvent', 'Concert'])).toBe('concert');
    expect(categoryOfTypes(['TheaterEvent', 'ShowEvent'])).toBe('theatre');
    expect(categoryOfTypes(['SportsEvent'])).toBe('sport');
    expect(categoryOfTypes(['Conference'])).toBe('animation');
  });
});

describe('France voisine dans les localités', () => {
  it('une position près de la frontière reste dans son pays', () => {
    // Moillesulaz : côté suisse (Thônex GE) et côté français (Gaillard 74), à quelques centaines de mètres
    expect(cantonAt(46.1952, 6.2129, 'CH')).toBe('GE');
    expect(cantonAt(46.1952, 6.2129, 'FR')).toBe('74');
    expect(cantonAt(46.3364, 6.0588, 'FR')).toBe('01');
  });
  it('les communes françaises se cherchent', () => {
    expect(searchLocalities('Annemasse').map(l => l.canton)).toContain('74');
    expect(searchLocalities('Ferney').some(l => l.canton === '01')).toBe(true);
  });
});
