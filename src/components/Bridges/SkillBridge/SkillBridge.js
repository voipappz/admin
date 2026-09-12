import { useState, useEffect, useCallback } from 'react';
import { skillsApi, SKILL_COLORS } from '../../../services/api/skillsApi';

/**
 * Custom hook for SkillBridge component
 * Provides state management for skill creation/editing
 */
export const useSkillBridge = (open, skill = null, mode = 'create', defaultType = 'user') => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: defaultType,
    color: SKILL_COLORS[0],
    enabled: true,
    notes: ''
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Skill types from API
  const [skillTypes, setSkillTypes] = useState([]);
  const [skillTypesLoading, setSkillTypesLoading] = useState(false);

  // Fetch skill types on mount
  useEffect(() => {
    const fetchSkillTypes = async () => {
      setSkillTypesLoading(true);
      try {
        const response = await skillsApi.getSkillTypes();
        // Response might be an array or object with data property
        const types = Array.isArray(response) ? response : (response?.data || []);
        setSkillTypes(types);
      } catch (err) {
        console.error('Error fetching skill types:', err);
        // Fallback to default types if API fails
        setSkillTypes(['customer', 'call', 'conversation', 'contact', 'campaign', 'queue', 'extension', 'number', 'generic', 'user']);
      } finally {
        setSkillTypesLoading(false);
      }
    };

    if (open) {
      fetchSkillTypes();
    }
  }, [open]);

  // Initialize form data when skill changes or dialog opens
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && skill) {
        // Edit mode - populate from existing skill
        setFormData({
          name: skill.name || '',
          type: skill.type || defaultType,
          color: skill.color || SKILL_COLORS[0],
          enabled: skill.enabled !== undefined ? skill.enabled : true,
          notes: skill.notes || ''
        });
      } else {
        // Create mode - reset form with random color
        const randomColor = SKILL_COLORS[Math.floor(Math.random() * SKILL_COLORS.length)];
        setFormData({
          name: '',
          type: defaultType,
          color: randomColor,
          enabled: true,
          notes: ''
        });
      }
      setError(null);
      setFormErrors({});
    }
  }, [open, skill, mode, defaultType]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setFormData({
        name: '',
        type: defaultType,
        color: SKILL_COLORS[0],
        enabled: true,
        notes: ''
      });
      setFormErrors({});
      setError(null);
    }
  }, [open, defaultType]);

  // Handle form field change
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [formErrors]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.type) {
      errors.type = 'Type is required';
    }

    if (!formData.color) {
      errors.color = 'Color is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Create skill
  const createSkill = useCallback(async () => {
    if (!validateForm()) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const skillData = {
        name: formData.name,
        type: formData.type,
        color: formData.color,
        enabled: formData.enabled,
        notes: formData.notes
      };

      const result = await skillsApi.createSkill(skillData);
      const createdSkill = result.data || result;
      return createdSkill;
    } catch (err) {
      console.error('Error creating skill:', err);
      setError(err.message || 'Failed to create skill');
      return null;
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm]);

  // Update skill
  const updateSkill = useCallback(async (skillId) => {
    if (!validateForm()) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const skillData = {
        name: formData.name,
        type: formData.type,
        color: formData.color,
        enabled: formData.enabled,
        notes: formData.notes
      };

      const result = await skillsApi.updateSkill(skillId, skillData);
      const updatedSkill = result.data || result;
      return updatedSkill;
    } catch (err) {
      console.error('Error updating skill:', err);
      setError(err.message || 'Failed to update skill');
      return null;
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm]);

  return {
    // Form state
    formData,
    formErrors,
    handleChange,
    validateForm,

    // Skill types
    skillTypes,
    skillTypesLoading,

    // Color palette
    SKILL_COLORS,

    // Actions
    createSkill,
    updateSkill,

    // UI state
    loading,
    error,
    setError
  };
};

export default useSkillBridge;
