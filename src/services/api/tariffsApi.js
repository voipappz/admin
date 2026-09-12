import { apiService, toFormData } from '../apiService';

/**
 * Tariff API service
 * Handles all tariff-related API operations including rates management
 *
 * Legacy Reference:
 * - ~/va-voipbox-admin/src/scripts/services/tariffs/resource.js
 */
export const tariffsApi = {
  /**
   * Get all tariffs with optional filtering
   * @param {object} params - Filter parameters (page, per_page, search, etc.)
   */
  getTariffs: async (params = {}) => {
    // Build query string with proper search parameter encoding
    const queryParts = [];
    queryParts.push(`page=${params.page || 1}`);
    queryParts.push(`per_page=${params.per_page || params.limit || 9999}`);

    if (params.enabled !== undefined) {
      queryParts.push(`search[enabled]=${params.enabled}`);
    }

    // Note: Tariffs are global, not environment-scoped
    // environment_uuid parameter is NOT used for tariffs API

    if (params.name) {
      queryParts.push(`search[name]=${encodeURIComponent(params.name)}`);
    }

    // Scheme is an ordinary searchable column (ILIKE via the search mediator),
    // and order_by/order_type are handled generically for every model — the
    // Tariffs screen needs both for its sortable table.
    if (params.scheme) {
      queryParts.push(`search[scheme]=${encodeURIComponent(params.scheme)}`);
    }
    if (params.order_by) {
      queryParts.push(`order_by=${encodeURIComponent(params.order_by)}`);
      queryParts.push(`order_type=${encodeURIComponent(params.order_type || 'desc')}`);
    }

    const url = `/api/tariffs?${queryParts.join('&')}`;
    console.log('Fetching tariffs:', url);

    return await apiService.get(url, {}, 'fetching tariffs', true);
  },

  /**
   * Get tariff by ID
   */
  getTariff: async (tariffId) => {
    return await apiService.get(`/api/tariffs/${tariffId}`);
  },

  /**
   * Create new tariff
   */
  createTariff: async (tariffData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(tariffData);

    return await apiService.post('/api/tariffs', formData, headers, 'creating tariff', true);
  },

  /**
   * Update tariff
   */
  updateTariff: async (tariffId, tariffData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(tariffData);

    return await apiService.patch(`/api/tariffs/${tariffId}`, formData, headers, `updating tariff ${tariffId}`, true);
  },

  /**
   * Delete tariff
   */
  deleteTariff: async (tariffId) => {
    return await apiService.delete(`/api/tariffs/${tariffId}`);
  },

  /**
   * Get tariff items/prices for a specific tariff
   */
  getTariffItems: async (tariffId) => {
    return await apiService.get(`/api/tariffs/${tariffId}/items`);
  },

  /**
   * Create tariff item/price
   */
  createTariffItem: async (tariffId, itemData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(itemData);

    return await apiService.post(`/api/tariffs/${tariffId}/items`, formData, headers, 'creating tariff item', true);
  },

  /**
   * Update tariff item/price
   */
  updateTariffItem: async (tariffId, itemId, itemData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(itemData);

    return await apiService.patch(`/api/tariffs/${tariffId}/items/${itemId}`, formData, headers, `updating tariff item ${itemId}`, true);
  },

  /**
   * Delete tariff item/price
   */
  deleteTariffItem: async (tariffId, itemId) => {
    return await apiService.delete(`/api/tariffs/${tariffId}/items/${itemId}`);
  },

  // ===============================
  // Tariff Rates API (legacy endpoint)
  // ===============================

  /**
   * Get rates for a tariff
   * @param {string} tariffId - Tariff UUID
   * @param {object} params - Filter parameters
   */
  getRates: async (tariffId, params = {}) => {
    const queryParts = [];
    queryParts.push(`page=${params.page || 1}`);
    queryParts.push(`per_page=${params.per_page || params.limit || 9999}`);

    if (params.order_by) {
      queryParts.push(`order_by=${params.order_by}`);
    }
    if (params.order_kind) {
      queryParts.push(`order_type=${params.order_kind}`);
    }

    const url = `/api/tariffs/${tariffId}/rates?${queryParts.join('&')}`;
    console.log('Fetching tariff rates:', url);

    return await apiService.get(url, {}, 'fetching tariff rates', true);
  },

  /**
   * Set rates for a tariff (replaces all existing rates)
   * API expects: rates[0][name], rates[0][price], rates[0][val], rates[1][name], ...
   * @param {string} tariffId - Tariff UUID
   * @param {Array} ratesArray - Array of rate objects {name, price, val}
   */
  setRates: async (tariffId, ratesArray) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Build form data with rates array format expected by API
    const formData = new URLSearchParams();
    ratesArray.forEach((rate, index) => {
      formData.append(`rates[${index}][name]`, rate.name || '');
      formData.append(`rates[${index}][price]`, rate.price || '0');
      formData.append(`rates[${index}][val]`, rate.val || '');
    });

    console.log('Setting rates for tariff:', tariffId, formData.toString());
    return await apiService.post(`/api/tariffs/${tariffId}/rates`, formData, headers, 'setting tariff rates', true);
  },

  /**
   * Import rates from CSV file
   * @param {string} tariffId - Tariff UUID
   * @param {File} file - CSV file
   */
  importRatesFromFile: async (tariffId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    console.log('Importing rates from file for tariff:', tariffId);
    return await apiService.post(`/api/tariffs/${tariffId}/rates`, formData, {}, 'importing tariff rates from file', true);
  },

  /**
   * Update rate
   * Note: Rate updates use /api/tariffs/rates/:rateId (not nested under tariff)
   * @param {string} rateId - Rate UUID
   * @param {object} rateData - Updated rate data
   */
  updateRate: async (rateId, rateData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = toFormData(rateData);

    console.log('Updating rate:', rateId, formData.toString());
    return await apiService.patch(`/api/tariffs/rates/${rateId}`, formData, headers, 'updating tariff rate', true);
  },

  /**
   * Delete rate
   * Note: Rate deletes use /api/tariffs/rates/:rateId (not nested under tariff)
   * @param {string} rateId - Rate UUID
   */
  deleteRate: async (rateId) => {
    return await apiService.delete(`/api/tariffs/rates/${rateId}`);
  },

  // ===============================
  // Tariff Metadata
  // ===============================

  /**
   * DEPRECATED — does not return schemes.
   *
   * `action=schemes` is not a recognised action on /api/tariffs (the endpoint
   * handles only `types`, `rates` and `rate`), so this request falls through
   * to the ordinary list and answers with tariff RECORDS. Callers that mapped
   * `s.scheme` over the result got one entry per existing tariff — duplicated,
   * and missing any scheme not currently in use.
   *
   * Both former callers (TariffBridge, Tariffs) now build the vocabulary
   * locally. Delete this once a real schemes action exists, or never.
   *
   * @returns {Promise<Array>} tariff records, NOT schemes
   */
  getSchemes: async () => {
    try {
      return await apiService.get('/api/tariffs?action=schemes', {}, 'fetching tariff schemes', true);
    } catch (error) {
      console.error('Error fetching tariff schemes:', error);
      return [];
    }
  },

  /**
   * Get available services for tariffs
   * @returns {Promise<Array>} List of services
   */
  getServices: async () => {
    try {
      return await apiService.get('/api/tariffs?action=services', {}, 'fetching tariff services', true);
    } catch (error) {
      console.error('Error fetching tariff services:', error);
      return [];
    }
  },

  /**
   * Get environments where tariff is applied
   * @param {string} tariffId - Tariff UUID
   * @returns {Promise<Array>} List of environment UUIDs
   */
  getAppliedEnvironments: async (tariffId) => {
    try {
      return await apiService.get(`/api/tariffs/${tariffId}?action=environment_uuids`, {}, 'fetching applied environments', true);
    } catch (error) {
      console.error('Error fetching applied environments:', error);
      return [];
    }
  },

  /**
   * Duplicate tariff
   * @param {string} tariffId - Tariff UUID to duplicate
   */
  duplicateTariff: async (tariffId) => {
    const formData = new URLSearchParams();
    return await apiService.post(`/api/tariffs/${tariffId}`, formData, {}, 'duplicating tariff');
  }
};