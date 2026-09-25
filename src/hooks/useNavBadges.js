import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';

/**
 * useNavBadges — live counts for the sidebar nav (module-level singleton, one
 * poll loop shared by all consumers, same pattern as useApiHealth):
 *   liveCalls      — active calls on the switch (Calls nav badge)
 *   criticalEvents — critical events in the last 24h (Events nav badge)
 *   openAlerts     — unread monitoring alerts (Monitoring nav badge), with
 *   criticalAlerts   how many of them are critical (the badge turns red)
 * Polls every 30s; silent on errors (badges just hide). refreshNavBadges()
 * re-polls at once, e.g. after alerts are marked read.
 */
const state = { liveCalls: 0, criticalEvents: 0, openAlerts: 0, criticalAlerts: 0 };
const subscribers = new Set();
let intervalId = null;
let started = false;

const notify = () => subscribers.forEach((fn) => fn({ ...state }));

const poll = async () => {
  try {
    const calls = await apiService.get('/api/calls?action=live', {}, 'live calls badge', false, true);
    state.liveCalls = Array.isArray(calls) ? calls.length : 0;
  } catch {
    state.liveCalls = 0;
  }
  try {
    const stats = await apiService.get('/api/events/stats', {}, 'events badge', false, true);
    state.criticalEvents = Number(stats?.critical_events) || 0;
  } catch {
    state.criticalEvents = 0;
  }
  try {
    const stats = await apiService.get('/api/monitoring/alerts/stats', {}, 'alerts badge', false, true);
    state.openAlerts = Number(stats?.total) || 0;
    state.criticalAlerts = Number(stats?.by_level?.critical) || 0;
  } catch {
    state.openAlerts = 0;
    state.criticalAlerts = 0;
  }
  notify();
};

export const refreshNavBadges = () => poll();

// `enabled` false (a portal user session): no polling — the three endpoints are
// account-only — and no counts.
const EMPTY = { liveCalls: 0, criticalEvents: 0, openAlerts: 0, criticalAlerts: 0 };

export const useNavBadges = (enabled = true) => {
  const [snapshot, setSnapshot] = useState({ ...state });

  useEffect(() => {
    if (!enabled) return undefined;
    subscribers.add(setSnapshot);
    if (!started) {
      started = true;
      poll();
      intervalId = setInterval(poll, 30000);
    }
    return () => {
      subscribers.delete(setSnapshot);
      if (subscribers.size === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        started = false;
      }
    };
  }, [enabled]);

  return enabled ? snapshot : EMPTY;
};

export default useNavBadges;
