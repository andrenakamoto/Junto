import { useState, useCallback } from 'react';

function load(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}

function save(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function useUnread() {
  const [unreadCircles, setUnreadCircles] = useState<Set<string>>(() => load('junto_unread_circles'));
  const [unreadPlans, setUnreadPlans] = useState<Set<string>>(() => load('junto_unread_plans'));

  const markCircle = useCallback((circleId: string) => {
    setUnreadCircles(prev => {
      const next = new Set(prev).add(circleId);
      save('junto_unread_circles', next);
      return next;
    });
  }, []);

  const markPlan = useCallback((planId: string) => {
    setUnreadPlans(prev => {
      const next = new Set(prev).add(planId);
      save('junto_unread_plans', next);
      return next;
    });
  }, []);

  const clearCircle = useCallback((circleId: string) => {
    setUnreadCircles(prev => {
      const next = new Set(prev);
      next.delete(circleId);
      save('junto_unread_circles', next);
      return next;
    });
  }, []);

  const clearPlan = useCallback((planId: string) => {
    setUnreadPlans(prev => {
      const next = new Set(prev);
      next.delete(planId);
      save('junto_unread_plans', next);
      return next;
    });
  }, []);

  return { unreadCircles, unreadPlans, markCircle, markPlan, clearCircle, clearPlan };
}
