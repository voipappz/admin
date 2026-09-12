import { useState, useCallback, useEffect } from 'react';
import { botsApi } from '../../services/api/botsApi';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { useNotification } from '../../context/NotificationContext';

export const useBots = () => {
  // Context hooks
  const { selectedEnvironments } = useCustomerEnvironment();
  const selectedEnvironment = selectedEnvironments?.[0] || null;
  const { showSuccess, showError } = useNotification();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);
  const [validation, setValidation] = useState(null);

  // Fetch projects from API
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEnvironment?.uuid) {
        params.environment_uuid = selectedEnvironment.uuid;
      }
      const response = await botsApi.getBots(params);
      const projectsList = Array.isArray(response) ? response : (response?.data || []);

      const transformedProjects = projectsList.map(bot => ({
        ...bot,
        id: bot.uuid || bot.id,
      }));

      setProjects(transformedProjects);
    } catch (error) {
      console.error('Failed to fetch bot projects:', error);
      if (error?.status !== 404) {
        showError?.('Failed to load bot projects');
      }
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, showError]);

  // Fetch projects on mount and environment change
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Legacy compatibility - bots list
  const bots = projects.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status,
    createdAt: p.createdAt || p.created_at,
    updatedAt: p.updatedAt || p.updated_at,
    deployedAt: p.deployedAt || p.deployed_at,
  }));

  const selectedBot = selectedProject;
  const setSelectedBot = (bot) => {
    if (bot) {
      const project = projects.find(p => p.id === bot.id);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  };

  // Create new bot
  const createBot = useCallback(async (name) => {
    setLoading(true);
    try {
      const botData = {
        name,
        status: 'draft',
        environment_uuid: selectedEnvironment?.uuid,
      };

      const response = await botsApi.createBot(botData);
      const newProject = {
        ...response,
        id: response.uuid || response.id || `bot-${Date.now()}`,
        name,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setProjects(prev => [newProject, ...prev]);
      setSelectedProject(newProject);
      setIsCreateOpen(false);
      showSuccess?.('Bot created');
      return newProject;
    } catch (error) {
      console.error('Failed to create bot:', error);
      showError?.('Failed to create bot');
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, showSuccess, showError]);

  // Delete project
  const deleteBot = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const project = projects.find(p => p.id === projectId);
      if (project?.uuid) {
        await botsApi.deleteBot(project.uuid);
      }

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
      showSuccess?.('Bot deleted');
    } catch (error) {
      console.error('Failed to delete bot:', error);
      showError?.('Failed to delete bot');
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
    } finally {
      setLoading(false);
    }
  }, [projects, selectedProject, showSuccess, showError]);

  // Deploy bot
  const deployBot = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const project = projects.find(p => p.id === projectId);
      const botId = project?.uuid;

      if (botId) {
        const report = await botsApi.validateBot(botId);
        setValidation(report);
        if (!report.valid) {
          showError?.(`Bot has ${report.errors.length} validation error${report.errors.length === 1 ? '' : 's'}`);
          return;
        }
        await botsApi.deployBot(botId);
      } else {
        showError?.('Bot has no UUID — save it first.');
        return;
      }

      const deployedAt = new Date().toISOString();
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, status: 'active', deployedAt } : p
      ));
      setSelectedProject(prev =>
        prev?.id === projectId ? { ...prev, status: 'active', deployedAt } : prev
      );

      showSuccess?.('Bot deployed successfully');
    } catch (error) {
      console.error('Deployment failed:', error);
      showError?.('Deployment failed');
    } finally {
      setLoading(false);
    }
  }, [projects, showSuccess, showError]);

  const validateBot = useCallback(async (botId) => {
    if (!botId) return null;
    try {
      const report = await botsApi.validateBot(botId);
      setValidation(report);
      return report;
    } catch (error) {
      console.error('Failed to validate bot:', error);
      setValidation(null);
      return null;
    }
  }, []);

  // Preview bot — generates Lua without deploying
  const previewBot = useCallback(async (botId) => {
    try {
      const result = await botsApi.previewBot(botId);
      showSuccess?.('Preview generated');
      return result;
    } catch (error) {
      console.error('Failed to preview bot:', error);
      showError?.('Failed to preview bot');
      throw error;
    }
  }, [showSuccess, showError]);

  // Update a single field on the selected project locally
  const updateBotField = useCallback((field, value) => {
    setSelectedProject(prev => {
      if (!prev) return prev;
      // Handle nested profile fields
      if (field.startsWith('profile.')) {
        const key = field.slice('profile.'.length);
        const profile = { ...(prev.profile || {}) };
        // Support one level of nesting: profile.voice_config.voice
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          profile[parent] = { ...(profile[parent] || {}), [child]: value };
        } else {
          profile[key] = value;
        }
        return { ...prev, profile };
      }
      return { ...prev, [field]: value };
    });
    // Also update projects list
    setProjects(prev => prev.map(p => {
      if (p.id !== selectedProject?.id) return p;
      if (field.startsWith('profile.')) {
        const key = field.slice('profile.'.length);
        const profile = { ...(p.profile || {}) };
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          profile[parent] = { ...(profile[parent] || {}), [child]: value };
        } else {
          profile[key] = value;
        }
        return { ...p, profile };
      }
      return { ...p, [field]: value };
    }));
  }, [selectedProject?.id]);

  // Save project — sends all settings fields
  const saveBot = useCallback(async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    if (!project.uuid) {
      showError?.('Bot has no UUID — cannot save. Try recreating it.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: project.name,
        status: project.status,
      };
      if (project.notes !== undefined) payload.notes = project.notes;
      if (project.enabled !== undefined) payload.enabled = project.enabled;
      if (project.profile) payload.profile = project.profile;
      await botsApi.updateBot(project.uuid, payload);

      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, updatedAt: new Date().toISOString() } : p
      ));
      showSuccess?.('Bot saved');
    } catch (error) {
      console.error('Failed to save bot:', error);
      showError?.('Failed to save bot');
    } finally {
      setLoading(false);
    }
  }, [projects, showSuccess, showError]);

  // Send a real turn through the same Ruby/Redis engine used by voice.
  const sendChatMessage = useCallback(async (message) => {
    if (!message.trim() || !selectedProject?.uuid) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const result = await botsApi.runTurn(selectedProject.uuid, {
        message,
        sessionId: chatSessionId,
        requestId: globalThis.crypto?.randomUUID?.() || `admin-${Date.now()}`,
      });
      setChatSessionId(result.session_id || result.session_key || chatSessionId);
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: result.say || result.reply || '',
        timestamp: new Date().toISOString(),
        result,
      }]);
    } catch (error) {
      console.error('Failed to run bot turn:', error);
      showError?.('Bot test failed');
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: error?.message || 'Bot test failed',
        timestamp: new Date().toISOString(),
        error: true,
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [selectedProject?.uuid, chatSessionId, showError]);

  // Clear chat history
  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatSessionId(null);
  }, []);

  // ─── BotReply state management ────────────────────
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  const fetchReplies = useCallback(async (botId) => {
    if (!botId) return;
    setRepliesLoading(true);
    try {
      const response = await botsApi.getReplies(botId);
      setReplies(Array.isArray(response) ? response : []);
      await validateBot(botId);
    } catch (error) {
      console.error('Failed to fetch replies:', error);
      setReplies([]);
    } finally {
      setRepliesLoading(false);
    }
  }, [validateBot]);

  const createReply = useCallback(async (botId, replyData) => {
    try {
      const reply = await botsApi.createReply(botId, replyData);
      setReplies(prev => [...prev, reply]);
      await validateBot(botId);
      showSuccess?.('Reply created');
      return reply;
    } catch (error) {
      console.error('Failed to create reply:', error);
      showError?.('Failed to create reply');
      throw error;
    }
  }, [showSuccess, showError, validateBot]);

  const updateReply = useCallback(async (botId, replyUuid, replyData) => {
    try {
      const updated = await botsApi.updateReply(botId, replyUuid, replyData);
      setReplies(prev => prev.map(r => r.uuid === replyUuid ? updated : r));
      await validateBot(botId);
      showSuccess?.('Reply updated');
      return updated;
    } catch (error) {
      console.error('Failed to update reply:', error);
      showError?.('Failed to update reply');
      throw error;
    }
  }, [showSuccess, showError, validateBot]);

  const deleteReply = useCallback(async (botId, replyUuid) => {
    try {
      await botsApi.deleteReply(botId, replyUuid);
      setReplies(prev => prev.filter(r => r.uuid !== replyUuid));
      await validateBot(botId);
      showSuccess?.('Reply deleted');
    } catch (error) {
      console.error('Failed to delete reply:', error);
      showError?.('Failed to delete reply');
    }
  }, [showSuccess, showError, validateBot]);

  return {
    bots,
    selectedBot,
    setSelectedBot,
    isCreateOpen,
    setIsCreateOpen,
    loading,
    createBot,
    deleteBot,
    deployBot,
    saveBot,
    projects,
    selectedProject,
    setSelectedProject,
    // Chat testing
    chatMessages,
    chatLoading,
    chatSessionId,
    sendChatMessage,
    clearChat,
    // API operations
    fetchProjects,
    previewBot,
    validation,
    validateBot,
    // BotReply CRUD
    replies,
    repliesLoading,
    fetchReplies,
    createReply,
    updateReply,
    deleteReply,
    // Settings
    updateBotField,
  };
};

export default useBots;
