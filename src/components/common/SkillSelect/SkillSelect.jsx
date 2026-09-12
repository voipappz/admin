import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { SkillBridge } from '../../Bridges/SkillBridge/SkillBridge.jsx';
import { skillsApi, getContrastTextColor } from '../../../services/api/skillsApi';

/**
 * SkillSelect Component
 * Autocomplete dropdown for selecting skills with inline create functionality
 *
 * Props:
 * - value: Array<String> - Selected skill UUIDs (multi-select)
 * - onChange: Function - Handler for selection change, receives array of UUIDs
 * - skills: Array - List of skills (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "Skills")
 * - typeFilter: String - Filter by skill type (e.g., 'user')
 * - onSkillCreated: Function - Callback after skill is created
 * - fullWidth: Boolean - Full width (default: true)
 * - multiple: Boolean - Allow multiple selection (default: true)
 * - size: 'small' | 'medium' - Field size
 */
const SkillSelect = ({
  value = [],
  onChange,
  skills: externalSkills,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'Skills',
  typeFilter,
  onSkillCreated,
  fullWidth = true,
  multiple = true,
  size = 'small'
}) => {
  // Internal state for skills if not provided externally
  const [internalSkills, setInternalSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Determine which skills list to use
  const skills = externalSkills || internalSkills;
  const loading = externalLoading || skillsLoading;

  // Fetch skills on mount if not provided externally
  const fetchSkills = useCallback(async () => {
    if (externalSkills) return;

    setSkillsLoading(true);
    try {
      const params = { per_page: 9999 };
      if (typeFilter) {
        params.type = typeFilter;
      }
      const response = await skillsApi.getSkills(params);
      const skillsList = Array.isArray(response) ? response : (response?.data || []);
      setInternalSkills(skillsList);
    } catch (err) {
      console.error('Error fetching skills:', err);
      setInternalSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  }, [externalSkills, typeFilter]);

  useEffect(() => {
    if (!externalSkills) {
      fetchSkills();
    }
  }, [externalSkills, fetchSkills]);

  // Convert value (array of UUIDs) to skill objects for display
  const selectedSkills = multiple
    ? skills.filter(skill => value.includes(skill.uuid))
    : skills.find(skill => skill.uuid === value) || null;

  // Handle selection change
  const handleChange = useCallback((event, newValue) => {
    if (multiple) {
      const uuids = newValue.map(skill => skill.uuid);
      onChange?.(uuids);
    } else {
      onChange?.(newValue?.uuid || '');
    }
  }, [multiple, onChange]);

  // Open create dialog
  const handleCreate = useCallback(() => {
    setDialogOpen(true);
  }, []);

  // Handle save from SkillBridge
  const handleSave = useCallback(async (savedSkill) => {
    // Refresh skills list
    if (!externalSkills) {
      await fetchSkills();
    }

    // Add the newly created skill to selection
    if (multiple) {
      if (savedSkill?.uuid && !value.includes(savedSkill.uuid)) {
        onChange?.([...value, savedSkill.uuid]);
      }
    } else {
      onChange?.(savedSkill?.uuid || '');
    }

    onSkillCreated?.(savedSkill);
    setDialogOpen(false);
  }, [externalSkills, fetchSkills, multiple, value, onChange, onSkillCreated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  // Render skill chip with color
  const renderSkillChip = (skill, props = {}) => {
    const backgroundColor = skill.color || '#607D8B';
    const textColor = getContrastTextColor(backgroundColor);

    return (
      <Chip
        {...props}
        label={skill.name}
        size="small"
        sx={{
          backgroundColor,
          color: textColor,
          fontWeight: 500,
          '& .MuiChip-deleteIcon': {
            color: textColor,
            opacity: 0.7,
            '&:hover': {
              color: textColor,
              opacity: 1
            }
          }
        }}
      />
    );
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          multiple={multiple}
          value={selectedSkills}
          onChange={handleChange}
          options={skills}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => option?.uuid === value?.uuid}
          loading={loading}
          disabled={disabled}
          fullWidth={fullWidth}
          size={size}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              error={error}
              helperText={helperText}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <LocalOfferIcon sx={{ color: 'action.active', mr: 0.5, ml: 0.5 }} fontSize="small" />
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {loading ? (
                      <CircularProgress color="inherit" size={18} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
          renderTags={(skillValue, getTagProps) =>
            skillValue.map((skill, index) => {
              const { key, ...otherProps } = getTagProps({ index });
              return renderSkillChip(skill, { key, ...otherProps });
            })
          }
          renderOption={(props, option) => {
            const { key, ...restProps } = props;
            const backgroundColor = option.color || '#607D8B';

            return (
              <li key={key} {...restProps}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor,
                      flexShrink: 0
                    }}
                  />
                  <span style={{ flexGrow: 1 }}>{option.name}</span>
                  {option.type && (
                    <Chip
                      label={option.type}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Box>
              </li>
            );
          }}
        />

        {/* Create button */}
        <Tooltip title="Create New Skill">
          <span>
            <IconButton
              onClick={handleCreate}
              disabled={disabled}
              color="primary"
              sx={{ mt: size === 'small' ? 0.5 : 1 }}
              size="small"
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Skill Create Dialog */}
      <SkillBridge
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        mode="create"
        defaultType={typeFilter || 'user'}
      />
    </>
  );
};

export default SkillSelect;
