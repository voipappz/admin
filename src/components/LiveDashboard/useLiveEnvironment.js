import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserAuth } from '../../context/UserAuthContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

// Per customer: the environment an account last picked on the Live screen.
const storageKey = (customerUuid) => `live_environment:${customerUuid}`;
const readPicked = (customerUuid) => {
  try { return customerUuid ? localStorage.getItem(storageKey(customerUuid)) || '' : ''; } catch { return ''; }
};

/**
 * Which ONE environment Live monitors: LiveChannel is subscribed per
 * environment.
 *
 * A portal user: their own, nothing to pick. An account: the one it picks on
 * the Live screen, remembered per customer in this browser. Until it picks, the
 * first environment selected in the top bar — which is a multi-select, and
 * says nothing about which of several to watch.
 */
export function useLiveEnvironment() {
  const { user } = useUserAuth();
  const { selectedCustomer, selectedEnvironments, fetchAllEnvironments } = useCustomerEnvironment();
  const customerUuid = selectedCustomer?.uuid || '';
  const own = user?.environment;

  const [options, setOptions] = useState([]);
  const [picked, setPicked] = useState(() => readPicked(customerUuid));

  useEffect(() => { setPicked(readPicked(customerUuid)); }, [customerUuid]);

  useEffect(() => {
    if (own?.uuid || !customerUuid || !fetchAllEnvironments) return undefined;
    let alive = true;
    Promise.resolve(fetchAllEnvironments(customerUuid))
      .then((list) => { if (alive && Array.isArray(list)) setOptions(list); })
      .catch(() => { /* the top bar's selection still answers */ });
    return () => { alive = false; };
  }, [own?.uuid, customerUuid, fetchAllEnvironments]);

  const pick = useCallback((uuid) => {
    setPicked(uuid);
    try { if (customerUuid) localStorage.setItem(storageKey(customerUuid), uuid); } catch { /* storage unavailable */ }
  }, [customerUuid]);

  return useMemo(() => {
    if (own?.uuid) return { uuid: own.uuid, name: own.name || '', pickable: false, options: [], choices: [], pick };
    const first = Array.isArray(selectedEnvironments) ? selectedEnvironments[0] : null;
    // What the picker lists: the customer's environments, and the top bar's
    // selection while those are still loading. One entry per environment.
    const choices = [...options, ...(selectedEnvironments || [])]
      .filter((e, i, all) => e?.uuid && all.findIndex((x) => x.uuid === e.uuid) === i);
    const chosen = (picked && choices.find((e) => e.uuid === picked)) || first || null;
    return { uuid: chosen?.uuid || '', name: chosen?.name || '', pickable: true, options, choices, pick };
  }, [own?.uuid, own?.name, selectedEnvironments, options, picked, pick]);
}
