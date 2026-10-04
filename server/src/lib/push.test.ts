import { describe, expect, it } from 'vitest';
import { pushContent } from './push';

describe('pushContent', () => {
  it("n'inclut jamais le texte d'un message", () => {
    const secret = 'code de la porte 1234';
    for (const type of ['new_message', 'mention', 'poll_message']) {
      const c = pushContent({ type, planId: 'p1', planTitle: 'Raclette', circleId: 'c1', pollId: 'q1', from: 'julie', preview: secret });
      expect(c).not.toBeNull();
      expect(JSON.stringify(c)).not.toContain(secret);
    }
  });

  it('ouvre le Plan ou le sondage concerné', () => {
    expect(pushContent({ type: 'new_message', planId: 'p1', from: 'julie' })?.url).toBe('/dashboard?planId=p1');
    expect(pushContent({ type: 'poll_message', circleId: 'c1', pollId: 'q1' })?.url).toBe('/dashboard?circleId=c1&pollId=q1');
    expect(pushContent({ type: 'join_request', circleId: 'c1', from: 'tom' })?.url).toBe('/dashboard?circleId=c1');
  });

  it('regroupe les messages d’un même Plan', () => {
    const a = pushContent({ type: 'new_message', planId: 'p1', from: 'julie' });
    const b = pushContent({ type: 'mention', planId: 'p1', from: 'tom' });
    expect(a?.group).toBe(b?.group);
  });

  it('suivi d’une suggestion : ouvre « Mes suggestions »', () => {
    const done = pushContent({ type: 'suggestion_update', suggestionId: 's1', status: 'done' })!;
    expect(done.body).toContain('réalisée');
    expect(done.url).toBe('/dashboard?suggestions=1');
    expect(pushContent({ type: 'suggestion_update', suggestionId: 's1', status: 'planned' })!.body).toContain('prévue');
  });

  it('ignore les types inconnus', () => {
    expect(pushContent({ type: 'autre' })).toBeNull();
  });
});
