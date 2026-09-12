import { apiService, toFormData } from '../apiService';

/**
 * Transactions API Service
 * Handles billing transaction history and manual credits/debits
 *
 * Backend: lib/endpoints/transactions.rb, lib/models/transaction.rb
 *
 * API Endpoints:
 * - GET    /api/transactions            - List transactions (filterable by subscription_uuid)
 * - GET    /api/transactions/:id        - Get a single transaction
 * - POST   /api/transactions            - Create a manual transaction (topup/credit)
 * - PATCH  /api/transactions/:id        - Update description/metadata
 *
 * Serialized fields (from backend):
 *   uuid, subscription_uuid, tariff_uuid, amount, notes, meta,
 *   period_start, period_end, created_at, updated_at
 *
 * Amount convention: amount is a signed integer in UNITS (no currency — an
 * external billing system converts units to money). Negative = period charge/bill,
 * Positive = credit/topup. Period invoices carry meta = { fee_units, usage_units }.
 */

const TRANSACTIONS_BASE = '/api/transactions';

export const transactionsApi = {
  /**
   * Get transactions with optional filtering
   * @param {object} params - Filter parameters
   * @param {string} params.subscription_uuid - Filter by subscription
   * @param {number} params.page - Page number (1-indexed)
   * @param {number} params.per_page - Items per page
   * @param {string} params.order_by - Sort field (e.g. 'created_at')
   * @param {string} params.order_type - Sort direction (asc/desc)
   */
  getTransactions: async (params = {}) => {
    const queryParts = [];
    queryParts.push(`page=${params.page || 1}`);
    queryParts.push(`per_page=${params.per_page || 50}`);

    if (params.subscription_uuid) {
      queryParts.push(`search[subscription_uuid]=${params.subscription_uuid}`);
    }
    if (params.order_by) {
      queryParts.push(`order_by=${params.order_by}`);
    }
    if (params.order_type) {
      queryParts.push(`order_type=${params.order_type}`);
    }

    const url = `${TRANSACTIONS_BASE}?${queryParts.join('&')}`;
    return await apiService.get(url, {}, 'fetching transactions', true);
  },

  /**
   * Get a single transaction by ID
   */
  getTransaction: async (transactionId) => {
    return await apiService.get(`${TRANSACTIONS_BASE}/${transactionId}`, {}, `fetching transaction ${transactionId}`);
  },

  /**
   * Create a manual transaction (topup / credit / adjustment)
   * Backend mediator: Mediators::Transaction::Create
   *
   * @param {object} data
   * @param {string} data.subscription_uuid - Subscription UUID
   * @param {string} data.type - Entry type (e.g. 'topup', 'charge')
   * @param {number} data.amount - Amount in cents (positive = credit, negative = debit)
   * @param {string} data.notes - Description/reason
   * @param {string} [data.provider_uuid] - Optional provider reference
   */
  createTransaction: async (data) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(data);
    return await apiService.post(TRANSACTIONS_BASE, formData, headers, 'creating transaction', true);
  }
};

export default transactionsApi;
