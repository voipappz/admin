import { config } from '../config';

class ConversationService {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
  }

  _authHeader(token) {
    if (!token) return {};
    const value = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { 'Authorization': value };
  }

  // Get all conversations with optional filters
  async getConversations(token, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.assignee) params.append('assignee', filters.assignee);
      if (filters.priority) params.append('priority', filters.priority);
      const query = params.toString() ? `?${params.toString()}` : '';

      const response = await fetch(`${this.baseUrl}/conversations${query}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Get a specific conversation
  async getConversation(id, token) {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  // Update a conversation
  async updateConversation(id, updates, token) {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
        body: JSON.stringify({ conversation: updates })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId, token) {
    try {
      const response = await fetch(`${this.baseUrl}/messages?conversation_uuid=${encodeURIComponent(conversationId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Create a message in a conversation
  async createMessage(conversationId, data, token) {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
        body: JSON.stringify({ ...data, conversation_uuid: conversationId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  // Mark a conversation as read
  async markRead(conversationId, token) {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  // Get conversation linked to a specific call by call UUID
  async getConversationByCallId(callId, token) {
    try {
      const response = await fetch(`${this.baseUrl}/conversations?call_uuid=${encodeURIComponent(callId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Return first matching conversation (API may return array or single object)
      if (Array.isArray(data)) return data[0] || null;
      if (data.data && Array.isArray(data.data)) return data.data[0] || null;
      return data || null;
    } catch (error) {
      console.error('Error fetching conversation by call ID:', error);
      throw error;
    }
  }

  // Get conversation counts by bucket
  async getCounts(token) {
    try {
      const response = await fetch(`${this.baseUrl}/conversations/counts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(token),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation counts:', error);
      throw error;
    }
  }
}

export const conversationService = new ConversationService();
export default conversationService;
