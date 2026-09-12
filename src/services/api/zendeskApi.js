/**
 * Zendesk API Service
 * Fetches ticket data from backend API (voipappz-api) which proxies to Zendesk
 *
 * The backend handles all Zendesk authentication and API calls.
 * This simplifies the admin by removing CORS issues and direct API credentials.
 */

// Backend API base URL - uses relative path for same-origin requests
const getBaseUrl = () => {
  // In development, Vite proxy forwards /tasks to the backend
  // In production, nginx handles the proxy
  return '/tasks';
};

/**
 * Get auth token from localStorage
 * @returns {string|null} JWT access token
 */
const getToken = () => {
  try {
    const authData = localStorage.getItem('auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.access;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
};

/**
 * Get default headers including Authorization
 * @returns {Object} Headers object with Content-Type and Authorization
 */
const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

// Zendesk is always available since backend handles auth
export const isZendeskConfigured = () => true;

/**
 * Fetch tickets from backend
 * @param {Object} params - Query parameters
 * @param {string} params.status - Filter by status (new, open, pending, solved, closed)
 * @param {number} params.per_page - Results per page (max 100)
 * @param {number} params.page - Page number
 * @param {string} params.sort_by - Sort field (created_at, updated_at, priority)
 * @param {string} params.sort_order - Sort order (asc, desc)
 * @returns {Promise<Object>} - Tickets data { tickets: [...], count: X }
 */
export const getTickets = async (params = {}) => {
  const queryParams = new URLSearchParams({
    per_page: params.per_page || 25,
    page: params.page || 1,
    sort_by: params.sort_by || 'created_at',
    sort_order: params.sort_order || 'desc',
  });

  // Add status filter if provided
  if (params.status) {
    queryParams.append('status', params.status);
  }

  const url = `${getBaseUrl()}/tickets?${queryParams}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      // Return empty result instead of throwing - prevents app crash
      console.warn(`[Zendesk] API returned ${response.status}, returning empty tickets`);
      return { tickets: [], count: 0 };
    }

    return await response.json();
  } catch (error) {
    // Return empty result instead of throwing - prevents app crash
    console.error('[Zendesk] Failed to fetch tickets:', error);
    return { tickets: [], count: 0 };
  }
};

/**
 * Get ticket statistics/counts
 * @returns {Promise<Object>} - Ticket counts by status
 */
export const getTicketStats = async () => {
  const url = `${getBaseUrl()}/tickets/stats`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to fetch ticket stats:', error);
    return {
      new: 0,
      open: 0,
      pending: 0,
      hold: 0,
      solved: 0,
      closed: 0,
      total: 0,
      open_tickets: 0,
    };
  }
};

/**
 * Get recent tickets for table display
 * @param {number} limit - Number of tickets to fetch
 * @returns {Promise<Array>} - Array of ticket objects
 */
export const getRecentTickets = async (limit = 10) => {
  try {
    const data = await getTickets({ per_page: limit, sort_by: 'updated_at', sort_order: 'desc' });
    return data.tickets || [];
  } catch (error) {
    console.error('[Zendesk] Failed to fetch recent tickets:', error);
    return [];
  }
};

/**
 * Search tickets
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results { results: [...], count: X }
 */
export const searchTickets = async (query) => {
  if (!query) {
    return { results: [], count: 0 };
  }

  const url = `${getBaseUrl()}/tickets/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Search failed:', error);
    return { results: [], count: 0 };
  }
};

/**
 * Get a single ticket by ID
 * @param {number|string} ticketId - Ticket ID
 * @returns {Promise<Object>} - Ticket data
 */
export const getTicket = async (ticketId) => {
  const url = `${getBaseUrl()}/tickets/${ticketId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to fetch ticket:', error);
    throw error;
  }
};

/**
 * Create a new ticket
 * @param {Object} ticketData - Ticket data
 * @param {string} ticketData.subject - Ticket subject
 * @param {string} ticketData.description - Ticket description/body
 * @param {string} ticketData.priority - Priority (low, normal, high, urgent)
 * @param {string} ticketData.requester_email - Requester email (optional)
 * @param {string} ticketData.customer_uuid - Customer UUID for tracking (optional)
 * @param {string} ticketData.account_email - Account email (optional)
 * @param {Array} ticketData.tags - Tags array (optional)
 * @param {Object} ticketData.custom_fields - Additional custom fields (optional)
 * @returns {Promise<Object>} - Created ticket { ticket: {...} }
 */
export const createTicket = async (ticketData) => {
  const url = `${getBaseUrl()}/tickets`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        subject: ticketData.subject,
        description: ticketData.description,
        priority: ticketData.priority || 'normal',
        requester_email: ticketData.requester_email,
        customer_uuid: ticketData.customer_uuid,
        account_email: ticketData.account_email,
        tags: ticketData.tags || [],
        custom_fields: ticketData.custom_fields || {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create ticket: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to create ticket:', error);
    throw error;
  }
};

/**
 * Update an existing ticket
 * @param {number|string} ticketId - Ticket ID
 * @param {Object} updateData - Fields to update
 * @param {string} updateData.status - New status
 * @param {string} updateData.priority - New priority
 * @param {string} updateData.subject - New subject
 * @param {string} updateData.comment - Add a comment
 * @param {boolean} updateData.public - Whether comment is public (default: true)
 * @returns {Promise<Object>} - Updated ticket
 */
export const updateTicket = async (ticketId, updateData) => {
  const url = `${getBaseUrl()}/tickets/${ticketId}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update ticket: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to update ticket:', error);
    throw error;
  }
};

/**
 * Run the support diagnostics toolkit for this customer and post the findings
 * into the ticket as an internal note (registrations/live state, failed-call
 * causes, error logs, recent events). Returns { ok, findings }.
 * @param {number|string} ticketId - Ticket ID
 */
export const runTicketDiagnostics = async (ticketId) => {
  const url = `${getBaseUrl()}/tickets/${ticketId}/diagnostics`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Diagnostics failed: ${response.status}`);
  }
  return response.json();
};

/**
 * Add a comment/reply to an existing ticket
 * @param {number|string} ticketId - Ticket ID
 * @param {Object} commentData - Comment data
 * @param {string} commentData.body - Comment text
 * @param {boolean} commentData.public - Whether comment is public (default: true)
 * @returns {Promise<Object>} - Updated ticket with new comment
 */
export const addTicketComment = async (ticketId, { body, public: isPublic = true }) => {
  const url = `${getBaseUrl()}/tickets/${ticketId}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        comment: body,
        public: isPublic,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to add comment: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to add comment:', error);
    throw error;
  }
};

/**
 * Get conversations (comments) for a ticket with resolved author details
 * @param {number|string} ticketId - Ticket ID
 * @param {Object} params - Query parameters
 * @param {string} params.type - Filter: 'public', 'internal', or 'all' (default: 'all')
 * @returns {Promise<Object>} - { ticket_id, conversations: [...], count }
 */
export const getTicketConversations = async (ticketId, params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.type) queryParams.append('type', params.type);

  const queryString = queryParams.toString();
  const url = `${getBaseUrl()}/tickets/${ticketId}/conversations${queryString ? '?' + queryString : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to fetch conversations:', error);
    throw error;
  }
};

/**
 * Add a conversation (public reply or internal note) to a ticket
 * @param {number|string} ticketId - Ticket ID
 * @param {Object} data - Conversation data
 * @param {string} data.body - Comment text
 * @param {boolean} data.public - true for public reply, false for internal note (default: true)
 * @returns {Promise<Object>} - { ticket_id, comment: {...} }
 */
export const addTicketConversation = async (ticketId, { body, public: isPublic = true }) => {
  const url = `${getBaseUrl()}/tickets/${ticketId}/conversations`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ body, public: isPublic }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to add conversation: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Zendesk] Failed to add conversation:', error);
    throw error;
  }
};

export const zendeskApi = {
  isConfigured: isZendeskConfigured,
  getTickets,
  getTicketStats,
  getRecentTickets,
  searchTickets,
  getTicket,
  createTicket,
  updateTicket,
  addTicketComment,
  getTicketConversations,
  addTicketConversation,
};

export default zendeskApi;
