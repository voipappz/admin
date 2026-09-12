import { apiService, toFormData } from '../apiService';

/**
 * Bots API Service
 * Handles all Bot-related API operations
 */
export const botsApi = {
  /**
   * Get all Bots for an environment
   */
  getBots: async (params = {}) => {
    try {
      console.log('Bots API: Getting Bots with params:', params);
      const response = await apiService.get('/api/bots', params, 'fetching bots');
      console.log('Bots API: Response:', response);
      return response;
    } catch (error) {
      console.error('Bots API: Error getting bots:', error);
      throw error;
    }
  },

  /**
   * Get single Bot by ID
   */
  getBot: async (id) => {
    try {
      console.log('Bots API: Getting Bot with id:', id);
      const response = await apiService.get(`/api/bots/${id}`, {}, `fetching bot ${id}`);
      console.log('Bots API: Response:', response);
      return response;
    } catch (error) {
      console.error('Bots API: Error getting bot:', error);
      throw error;
    }
  },

  /**
   * Create new Bot
   */
  createBot: async (botData) => {
    try {
      console.log('Bots API: Creating Bot with data:', botData);
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Use centralized toFormData helper for proper nested object encoding
      const formData = toFormData(botData);

      const response = await apiService.post('/api/bots', formData, headers, `creating bot ${botData.name}`, true);
      console.log('Bots API: Response:', response);
      return response;
    } catch (error) {
      console.error('Bots API: Error creating bot:', error);
      throw error;
    }
  },

  /**
   * Update existing Bot
   */
  updateBot: async (id, botData) => {
    try {
      console.log('Bots API: Updating Bot with id:', id, 'data:', botData);
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Use centralized toFormData helper for proper nested object encoding
      const formData = toFormData(botData);

      const response = await apiService.patch(`/api/bots/${id}`, formData, headers, `updating bot ${botData.name || id}`, true);
      console.log('Bots API: Response:', response);
      return response;
    } catch (error) {
      console.error('Bots API: Error updating bot:', error);
      throw error;
    }
  },

  /**
   * Delete Bot
   */
  deleteBot: async (id) => {
    try {
      console.log('Bots API: Deleting Bot with id:', id);
      const response = await apiService.delete(`/api/bots/${id}`, `deleting bot ${id}`);
      console.log('Bots API: Response:', response);
      return response;
    } catch (error) {
      console.error('Bots API: Error deleting bot:', error);
      throw error;
    }
  },

  // ============================================
  // BotReply Management
  // ============================================

  getReplies: async (botId) => {
    return apiService.get(`/api/bots/${botId}/replies`, {}, 'fetching bot replies');
  },

  createReply: async (botId, replyData) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('flow_name', replyData.flow_name || 'main');
    formData.append('state_name', replyData.state_name);
    formData.append('reply_type', replyData.reply_type);
    formData.append('content', JSON.stringify(replyData.content || {}));
    return apiService.post(`/api/bots/${botId}/replies`, formData, headers, 'creating bot reply', true);
  },

  updateReply: async (botId, replyUuid, replyData) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    if (replyData.state_name) formData.append('state_name', replyData.state_name);
    if (replyData.reply_type) formData.append('reply_type', replyData.reply_type);
    if (replyData.flow_name) formData.append('flow_name', replyData.flow_name);
    if (replyData.content !== undefined) formData.append('content', JSON.stringify(replyData.content));
    return apiService.patch(`/api/bots/${botId}/replies/${replyUuid}`, formData, headers, 'updating bot reply', true);
  },

  deleteReply: async (botId, replyUuid) => {
    return apiService.delete(`/api/bots/${botId}/replies/${replyUuid}`, 'deleting bot reply');
  },

  validateBot: async (botId) => {
    return apiService.get(`/api/bots/${botId}/validate`, {}, 'validating bot', false);
  },

  /** Run one real state-machine turn while preserving the Redis session. */
  runTurn: async (botId, { message, sessionId, requestId } = {}) => {
    const body = {
      message: message || '',
      ...(sessionId ? { session_id: sessionId } : {}),
      ...(requestId ? { request_id: requestId } : {}),
    };
    return apiService.post(`/api/bots/${botId}/turn`, body, {}, 'testing bot turn', false);
  },

  // ============================================
  // Bot-level Preview & Deploy
  // ============================================

  /**
   * Preview bot — generates Lua without deploying
   * @param {string} botId - The bot UUID
   * @returns {Promise<Object>} - Generated Lua output
   */
  previewBot: async (botId) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    return apiService.post(`/api/bots/${botId}/preview`, '', headers, 'previewing bot', false);
  },

  /**
   * Deploy bot — generates Lua and deploys to FreeSWITCH
   * @param {string} botId - The bot UUID
   * @returns {Promise<Object>} - Deployment result
   */
  deployBot: async (botId) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    return apiService.post(`/api/bots/${botId}/deploy`, '', headers, 'deploying bot', true);
  },
};
