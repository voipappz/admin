import { apiService, toFormData } from '../apiService';

/**
 * Skills API Service
 * Handles all skill management operations including CRUD and skillings (associations)
 *
 * Skill Schema:
 * - uuid, name, type, enabled, notes, meta, profile
 * - color: '#RRGGBB' (hex color)
 * - customer_uuid, created_at, updated_at
 *
 * Valid Skill Types: customer, call, conversation, contact, campaign, queue, extension, number, generic, user
 */

export const skillsApi = {
  /**
   * Get all skills with optional filtering
   * @param {Object} params - Query parameters
   * @param {string} params.type - Filter by skill type (e.g., 'user')
   * @param {boolean} params.enabled - Filter by enabled status
   * @param {string} params.search - Search by name
   * @param {number} params.page - Page number (1-indexed)
   * @param {number} params.per_page - Items per page
   * @returns {Promise<Array>} - Array of skill objects
   */
  getSkills: async (params = {}) => {
    const queryString = new URLSearchParams();

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryString.append(key, params[key]);
      }
    });

    const url = `/api/skills${queryString.toString() ? `?${queryString.toString()}` : ''}`;
    return apiService.get(url, {}, 'fetching skills', false);
  },

  /**
   * Get valid skill types
   * @returns {Promise<Array>} - Array of valid skill type strings
   */
  getSkillTypes: async () => {
    const url = `/api/skills?action=types`;
    return apiService.get(url, {}, 'fetching skill types', false);
  },

  /**
   * Get a single skill by ID
   * @param {string} skillId - The skill UUID
   * @returns {Promise<Object>} - Skill object
   */
  getSkill: async (skillId) => {
    const url = `/api/skills/${skillId}`;
    return apiService.get(url, {}, `fetching skill ${skillId}`, false);
  },

  /**
   * Create a new skill
   * @param {Object} skillData - Skill data
   * @param {string} skillData.name - Skill name (required)
   * @param {string} skillData.type - Skill type (e.g., 'user')
   * @param {string} skillData.color - Hex color (e.g., '#FF5722')
   * @param {boolean} skillData.enabled - Whether skill is enabled
   * @param {string} skillData.notes - Optional notes
   * @returns {Promise<Object>} - Created skill object
   */
  createSkill: async (skillData) => {
    const url = `/api/skills`;
    const formData = toFormData(skillData);
    return apiService.post(url, formData, {}, 'creating skill', true);
  },

  /**
   * Update an existing skill
   * @param {string} skillId - The skill UUID
   * @param {Object} skillData - Updated skill data
   * @returns {Promise<Object>} - Updated skill object
   */
  updateSkill: async (skillId, skillData) => {
    const url = `/api/skills/${skillId}`;
    const formData = toFormData(skillData);
    return apiService.patch(url, formData, {}, `updating skill ${skillId}`, true);
  },

  /**
   * Delete a skill (soft delete)
   * @param {string} skillId - The skill UUID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteSkill: async (skillId) => {
    const url = `/api/skills/${skillId}`;
    return apiService.delete(url, {}, `deleting skill ${skillId}`, true);
  },

  /**
   * Get skills for a specific entity (e.g., user)
   * This uses the skillings association table
   * @param {string} entityType - Entity type (e.g., 'user')
   * @param {string} entityUuid - Entity UUID
   * @returns {Promise<Array>} - Array of skill objects
   */
  getEntitySkills: async (entityType, entityUuid) => {
    const url = `/api/skills?type=${entityType}&entity_uuid=${entityUuid}`;
    return apiService.get(url, {}, `fetching skills for ${entityType} ${entityUuid}`, false);
  },

  /**
   * Set skills for an entity (replaces all existing skills)
   * Used when saving entity with skill_uuids array
   * @param {string} entityType - Entity type (e.g., 'user')
   * @param {string} entityUuid - Entity UUID
   * @param {Array<string>} skillUuids - Array of skill UUIDs to set
   * @returns {Promise<Object>} - Result
   */
  setEntitySkills: async (entityType, entityUuid, skillUuids) => {
    const url = `/api/${entityType}s/${entityUuid}/skills`;
    const formData = new URLSearchParams();

    // Encode as skill_uuids[]=uuid1&skill_uuids[]=uuid2
    skillUuids.forEach(uuid => {
      formData.append('skill_uuids[]', uuid);
    });

    return apiService.post(url, formData, {}, `setting skills for ${entityType}`, true);
  },

  /**
   * Add a single skill to an entity
   * @param {string} entityType - Entity type
   * @param {string} entityUuid - Entity UUID
   * @param {string} skillUuid - Skill UUID to add
   * @returns {Promise<Object>} - Result
   */
  addEntitySkill: async (entityType, entityUuid, skillUuid) => {
    const url = `/api/${entityType}s/${entityUuid}/skills/${skillUuid}`;
    return apiService.post(url, null, {}, `adding skill to ${entityType}`, true);
  },

  /**
   * Remove a single skill from an entity
   * @param {string} entityType - Entity type
   * @param {string} entityUuid - Entity UUID
   * @param {string} skillUuid - Skill UUID to remove
   * @returns {Promise<Object>} - Result
   */
  removeEntitySkill: async (entityType, entityUuid, skillUuid) => {
    const url = `/api/${entityType}s/${entityUuid}/skills/${skillUuid}`;
    return apiService.delete(url, {}, `removing skill from ${entityType}`, true);
  }
};

/**
 * Preset color palette for skills (12 colors)
 * These are Material Design colors for good contrast
 */
export const SKILL_COLORS = [
  '#F44336', // Red
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#FF9800', // Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
];

/**
 * Get contrasting text color (light/dark) based on background color
 * Uses luminance calculation for accessibility
 * @param {string} hexColor - Hex color (e.g., '#FF5722')
 * @returns {string} - '#ffffff' for dark text or '#000000' for light text
 */
export const getContrastTextColor = (hexColor) => {
  if (!hexColor) return '#000000';

  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white text for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

export default skillsApi;
