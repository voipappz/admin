import { useState, useEffect, useCallback } from 'react';
import { skillsApi } from '../../../services/api/skillsApi';

/**
 * Custom hook for SkillEditor component
 * Provides state management for inline skill editing
 */
export const useSkillEditor = (initialSkills = [], typeFilter = 'user') => {
  // Current skills associated with the entity
  const [skills, setSkills] = useState([]);

  // Available skills from API
  const [availableSkills, setAvailableSkills] = useState([]);
  const [availableSkillsLoading, setAvailableSkillsLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize skills from props
  useEffect(() => {
    if (Array.isArray(initialSkills)) {
      setSkills(initialSkills);
    }
  }, [initialSkills]);

  // Fetch available skills from API
  const fetchAvailableSkills = useCallback(async () => {
    setAvailableSkillsLoading(true);
    try {
      const params = { per_page: 9999, enabled: true };
      if (typeFilter) {
        params.type = typeFilter;
      }
      const response = await skillsApi.getSkills(params);
      const skillsList = Array.isArray(response) ? response : (response?.data || []);
      setAvailableSkills(skillsList);
    } catch (err) {
      console.error('Error fetching available skills:', err);
      setError(err.message || 'Failed to load skills');
      setAvailableSkills([]);
    } finally {
      setAvailableSkillsLoading(false);
    }
  }, [typeFilter]);

  // Load available skills on mount
  useEffect(() => {
    fetchAvailableSkills();
  }, [fetchAvailableSkills]);

  // Add a skill to the list
  const addSkill = useCallback((skill) => {
    if (!skill || !skill.uuid) return;

    // Check if already added
    const exists = skills.some(s => s.uuid === skill.uuid);
    if (exists) {
      setError('Skill already added');
      setTimeout(() => setError(null), 2000);
      return;
    }

    setSkills(prev => [...prev, skill]);
    setError(null);
  }, [skills]);

  // Remove a skill from the list
  const removeSkill = useCallback((skillId) => {
    setSkills(prev => prev.filter(s => s.uuid !== skillId && s.id !== skillId));
  }, []);

  // Get skills that haven't been added yet (for autocomplete)
  const getUnselectedSkills = useCallback(() => {
    const selectedUuids = new Set(skills.map(s => s.uuid));
    return availableSkills.filter(s => !selectedUuids.has(s.uuid));
  }, [skills, availableSkills]);

  // Handle creating a new skill and adding it
  const handleSkillCreated = useCallback((newSkill) => {
    if (newSkill) {
      // Add to available skills
      setAvailableSkills(prev => [...prev, newSkill]);
      // Add to selected skills
      addSkill(newSkill);
    }
  }, [addSkill]);

  // Get UUIDs for form submission
  const getSkillUuids = useCallback(() => {
    return skills.map(s => s.uuid);
  }, [skills]);

  // Set skills from UUIDs (when loading entity data)
  const setSkillsFromUuids = useCallback((uuids) => {
    if (!Array.isArray(uuids) || uuids.length === 0) {
      setSkills([]);
      return;
    }

    // Find full skill objects from available skills
    const skillObjects = availableSkills.filter(s => uuids.includes(s.uuid));

    // If some UUIDs don't match available skills, create placeholder objects
    const missingUuids = uuids.filter(uuid =>
      !availableSkills.some(s => s.uuid === uuid)
    );

    const placeholders = missingUuids.map(uuid => ({
      uuid,
      name: 'Unknown Skill',
      color: '#9E9E9E'
    }));

    setSkills([...skillObjects, ...placeholders]);
  }, [availableSkills]);

  return {
    // State
    skills,
    setSkills,
    availableSkills,
    availableSkillsLoading,

    // Actions
    addSkill,
    removeSkill,
    getUnselectedSkills,
    handleSkillCreated,
    getSkillUuids,
    setSkillsFromUuids,
    fetchAvailableSkills,

    // UI state
    loading,
    setLoading,
    error,
    setError
  };
};

export default useSkillEditor;
