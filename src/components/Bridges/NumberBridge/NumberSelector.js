import { useState, useEffect, useMemo, useCallback } from 'react';
import { numbersApi } from '../../../services/api/numbersApi.js';

/**
 * Debounce utility
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * useNumberSelector Hook
 * Custom hook for number selection with async search
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/scripts/directives/directives.js (select2ajax)
 *
 * Features:
 * - Async number search with debouncing (250ms)
 * - Environment-scoped filtering
 * - On-demand number creation
 * - Dual value tracking (UUID + display number)
 *
 * @param {string} selectedUuid - Currently selected number UUID
 * @param {string} environmentUuid - Environment UUID for filtering
 * @returns {object} Hook state and methods
 */
export const useNumberSelector = (selectedUuid, environmentUuid) => {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayValue, setDisplayValue] = useState(null);
  const [error, setError] = useState(null);

  // Load selected number on mount or when selectedUuid changes
  useEffect(() => {
    if (selectedUuid) {
      loadNumberByUuid(selectedUuid);
    } else {
      setDisplayValue(null);
    }
  }, [selectedUuid]);

  // Search-only: the destination list stays empty until the user types, so
  // opening a DID editor no longer pops an unsolicited list of numbers. The
  // current selection still renders via loadNumberByUuid below.

  /**
   * Load number by UUID (for displaying current selection)
   */
  const loadNumberByUuid = async (uuid) => {
    try {
      setLoading(true);
      setError(null);
      const number = await numbersApi.getNumber(uuid);
      setDisplayValue(number);
    } catch (error) {
      console.error('Error loading number:', error);
      setError(error.message);
      setDisplayValue(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search numbers with query and environment filter
   * @param {string} query - Search query
   */
  const searchNumber = async (query) => {
    if (!environmentUuid) {
      console.warn('Environment UUID is required for number search');
      setNumbers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await numbersApi.searchNumbers(query, environmentUuid);
      setNumbers(results);
    } catch (error) {
      console.error('Error searching numbers:', error);
      setError(error.message);
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Debounced search (250ms delay)
   * Memoized to prevent recreation on every render
   */
  const debouncedSearch = useMemo(
    () => debounce((query) => {
      if (query && query.length >= 1) {
        searchNumber(query);
      } else {
        setNumbers([]);
      }
    }, 250),
    [environmentUuid]
  );

  /**
   * Create new number
   * @param {string} number - Phone number to create
   * @param {string} environmentUuid - Environment UUID
   * @returns {Promise<object>} Created number object
   */
  const createNumber = async (number, environmentUuid) => {
    if (!number || !environmentUuid) {
      throw new Error('Number and environment UUID are required');
    }

    setLoading(true);
    setError(null);

    try {
      const created = await numbersApi.createNumber({
        number,
        environment_uuid: environmentUuid,
        enabled: true,
        blocked: false
      });

      // Add to numbers list
      setNumbers(prev => [created, ...prev]);

      return created;
    } catch (error) {
      console.error('Error creating number:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setNumbers([]);
    setDisplayValue(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    numbers,
    loading,
    displayValue,
    error,
    searchNumber,
    debouncedSearch,
    createNumber,
    loadNumberByUuid,
    clearError,
    reset
  };
};

export default useNumberSelector;
