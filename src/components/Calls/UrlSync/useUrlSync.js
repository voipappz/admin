import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { loadFilterParameters, convertApiParamsToSearchParams } from '../../../services/callsService';
import { useAuth } from '../../../context/AuthContext';
import { useIsUserSession } from '../../../hooks/useIsUserSession';

const useUrlSync = (fetchCalls, dateRange) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { access } = useAuth();
  const userSession = useIsUserSession();
  const [currentSearchParams, setCurrentSearchParams] = useState({});

  // Keep URL in sync with current search parameters
  const syncUrl = useCallback((params) => {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => usp.append(key, v));
      } else if (value !== undefined && value !== null && value !== '') {
        usp.append(key, value);
      }
    });
    navigate({ pathname: location.pathname, search: usp.toString() }, { replace: true });
  }, [navigate, location.pathname]);

  // On initial mount – if URL has params, apply them automatically, otherwise load saved params
  useEffect(() => {
    const qsEntries = Array.from(new URLSearchParams(location.search).entries());

    if (qsEntries.length === 0) {
      // No URL parameters, try to load saved parameters
      const loadSavedParams = async () => {
        if (access && !userSession) {
          try {
            const result = await loadFilterParameters(access);
            if (result.success && result.data && result.data.length > 0) {
              const savedParams = convertApiParamsToSearchParams(result.data);
              console.log('Auto-loaded saved filter parameters:', savedParams);
              setCurrentSearchParams(savedParams);
              fetchCalls(dateRange, savedParams);
            } else {
              // No saved parameters, load without filters
              fetchCalls(dateRange);
            }
          } catch (error) {
            console.warn('Failed to load saved parameters on mount:', error);
            fetchCalls(dateRange);
          }
        } else {
          // No auth token, load without filters
          fetchCalls(dateRange);
        }
      };
      
      loadSavedParams();
      return;
    }

    let urlParams = Object.fromEntries(qsEntries);
    const clientMode = urlParams['_client'] === '1';
    if (clientMode) delete urlParams['_client'];

    // Extract sorting parameters
    const sortParams = {};
    if (urlParams.order_by) {
      sortParams.order_by = urlParams.order_by;
      delete urlParams.order_by;
    }
    if (urlParams.order_type) {
      sortParams.order_type = urlParams.order_type;
      delete urlParams.order_type;
    }

    // Combine search and sort parameters
    const allParams = { ...urlParams, ...sortParams };
    setCurrentSearchParams(allParams);

    // trigger data fetch based on URL params
    if (clientMode) {
      // fetch base data without filters, then filter locally once loaded

      fetchCalls(dateRange);
    } else {

      fetchCalls(dateRange, allParams);
    }
  }, [access, dateRange, fetchCalls, location.search, userSession]);

  return {
    currentSearchParams,
    setCurrentSearchParams,
    syncUrl
  };
};

export default useUrlSync;
