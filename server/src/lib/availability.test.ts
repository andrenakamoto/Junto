import { describe, it, expect } from 'vitest';
import { availabilityExpiry, parseAvailability, parseThreshold, shouldNotify } from './availability';

const zurich = (d: Date) => new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' }).format(d);

describe('availabilityExpiry', () => {
  it('« maintenant » dure 3 heures', () => {
    const now = new Date('2026-10-21T16:00:00Z');
    expect(availabilityExpiry('now', now).toISOString()).toBe('2026-10-21T19:00:00.000Z');
  });

  it('« ce soir » : jusqu’au lendemain 4 h, heure suisse', () => {
    expect(zurich(availabilityExpiry('tonight', new Date('2026-10-21T16:00:00Z')))).toBe('22.10.26 04:00');
  });

  it('« ce soir » déclaré après minuit : jusqu’à 4 h le jour même', () => {
    // 01:30 à Zurich (heure d'été, UTC+2)
    expect(zurichtest('2026-07-09T23:30:00Z')).toBe('10.07.26 04:00');
  });

  it('passage à l’heure d’hiver : toujours 4 h à Zurich', () => {
    expect(zurich(availabilityExpiry('tonight', new Date('2026-10-24T18:00:00Z')))).toBe('25.10.26 04:00');
  });
});

function zurichtest(iso: string) { return zurich(availabilityExpiry('tonight', new Date(iso))); }

describe('parseAvailability', () => {
  it('créneau obligatoire, étiquettes connues seulement, 3 au plus', () => {
    expect(parseAvailability({ slot: 'demain' })).toBeNull();
    expect(parseAvailability({ slot: 'tonight', tags: ['apero', 'x', 'apero', 'cine', 'sport', 'jeux'] }))
      .toEqual({ slot: 'tonight', tags: ['apero', 'cine', 'sport'], note: null });
  });

  it('petit mot de 60 caractères au plus', () => {
    expect(parseAvailability({ slot: 'now', note: '  raclette ?  ' })?.note).toBe('raclette ?');
    expect(parseAvailability({ slot: 'now', note: 'x'.repeat(61) })).toBeNull();
  });
});

describe('réglages et notifications', () => {
  it('seuil entre 2 et 10', () => {
    expect(parseThreshold(3)).toBe(3);
    expect(parseThreshold(1)).toBeUndefined();
    expect(parseThreshold(11)).toBeUndefined();
    expect(parseThreshold('3')).toBeUndefined();
  });

  it('prévenir pour une nouvelle dispo ou un autre créneau, pas pour une retouche', () => {
    const now = new Date('2026-10-21T16:00:00Z');
    const valid = { slot: 'tonight', expiresAt: new Date('2026-10-22T02:00:00Z') };
    expect(shouldNotify(null, 'tonight', now)).toBe(true);
    expect(shouldNotify(valid, 'tonight', now)).toBe(false);
    expect(shouldNotify(valid, 'now', now)).toBe(true);
    expect(shouldNotify({ ...valid, expiresAt: new Date('2026-10-21T15:00:00Z') }, 'tonight', now)).toBe(true);
  });
});
