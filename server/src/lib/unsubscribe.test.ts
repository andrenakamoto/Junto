import { describe, expect, it, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

beforeAll(() => { process.env.JWT_SECRET = 'test-secret'; });

describe('désinscription en un clic', () => {
  it('fabrique et relit un lien propre à la personne et au résumé', async () => {
    const { unsubscribeToken, readUnsubscribeToken, unsubscribeLinks } = await import('./unsubscribe');
    expect(readUnsubscribeToken(unsubscribeToken('u1', 'digest'))).toEqual({ userId: 'u1', kind: 'digest' });
    expect(readUnsubscribeToken(unsubscribeToken('u1', 'cockpit:org_1'))).toEqual({ userId: 'u1', kind: 'cockpit:org_1' });
    const l = unsubscribeLinks('u1', 'digest');
    expect(l.page).toMatch(/\/desinscription\?t=/);
    expect(l.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
  it('refuse un autre jeton, un objet ou un faux', async () => {
    const { readUnsubscribeToken } = await import('./unsubscribe');
    expect(readUnsubscribeToken(jwt.sign({ userId: 'u1' }, 'test-secret'))).toBeNull();
    expect(readUnsubscribeToken(jwt.sign({ purpose: 'unsubscribe', uid: 'u1', kind: 'tout' }, 'test-secret'))).toBeNull();
    expect(readUnsubscribeToken(jwt.sign({ purpose: 'unsubscribe', uid: 'u1', kind: 'digest' }, 'autre'))).toBeNull();
    expect(readUnsubscribeToken({ not: '' })).toBeNull();
  });
});
