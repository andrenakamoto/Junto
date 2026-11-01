import { describe, expect, it } from 'vitest';
import { nextNudgeAt } from './planPending';

describe('nextNudgeAt', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  it('relance possible sans relance précédente', () => expect(nextNudgeAt(null, now)).toBeNull());
  it('relance possible après 24 h', () => expect(nextNudgeAt(new Date('2026-10-31T11:00:00Z'), now)).toBeNull());
  it('attendre moins de 24 h après la dernière', () => expect(nextNudgeAt(new Date('2026-11-01T08:00:00Z'), now)?.toISOString()).toBe('2026-11-02T08:00:00.000Z'));
});
