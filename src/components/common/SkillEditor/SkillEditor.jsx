import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  LocalOffer as SkillIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { useSkillEditor } from './SkillEditor.js';
import { SkillBridge } from '../../Bridges/SkillBridge/SkillBridge.jsx';
import SkillChip from '../SkillChip/SkillChip.jsx';

/**
 * SkillEditor Component
 * Inline skill management table following PlanBridge items pattern
 *
 * Props:
 * - entityType: String - Entity type (e.g., 'user')
 * - entityUuid: String - Entity UUID (for existing entities)
 * - skills: Array - Array of skill objects currently associated
 * - onSkillsChange: Function - Called with updated skills array when changes occur
 * - skillTypeFilter: String - Filter available skills by type (default: 'user')
 * - allowInlineCreate: Boolean - Allow creating new skills inline (default: true)
 * - disabled: Boolean - Disable all interactions
 * - maxHeight: Number - Max height of table container (default: 250)
 */
const SkillEditor = ({
  skills: propSkills = [],
  onSkillsChange,
  skillTypeFilter = 'user',
  allowInlineCreate = true,
  disabled = false,
  maxHeight = 250
}) => {
  const {
    skills,
    setSkills,
    availableSkillsLoading,
    addSkill,
    removeSkill,
    getUnselectedSkills,
    handleSkillCreated,
    error,
    setError
  } = useSkillEditor(propSkills, skillTypeFilter);

  // Selected skill in autocomplete
  const [selectedSkill, setSelectedSkill] = useState(null);

  // Skill dialog state
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  // Sync skills from props
  useEffect(() => {
    if (Array.isArray(propSkills)) {
      setSkills(propSkills);
    }
  }, [propSkills, setSkills]);

  // Notify parent when skills change
  useEffect(() => {
    if (onSkillsChange) {
      onSkillsChange(skills);
    }
  }, [skills, onSkillsChange]);

  // Handle adding a skill from autocomplete
  const handleAddSkill = useCallback(() => {
    if (selectedSkill) {
      addSkill(selectedSkill);
      setSelectedSkill(null);
    }
  }, [selectedSkill, addSkill]);

  // Handle removing a skill
  const handleRemoveSkill = useCallback((skillId) => {
    removeSkill(skillId);
  }, [removeSkill]);

  // Open create skill dialog
  const handleOpenCreateDialog = useCallback(() => {
    setEditingSkill(null);
    setSkillDialogOpen(true);
  }, []);

  // Open edit skill dialog
  const handleOpenEditDialog = useCallback((skill) => {
    setEditingSkill(skill);
    setSkillDialogOpen(true);
  }, []);

  // Handle skill saved from dialog
  const handleSkillSaved = useCallback((savedSkill) => {
    if (editingSkill) {
      // Update existing skill in list
      setSkills(prev => prev.map(s =>
        s.uuid === savedSkill.uuid ? savedSkill : s
      ));
    } else {
      // Add newly created skill
      handleSkillCreated(savedSkill);
    }
    setSkillDialogOpen(false);
    setEditingSkill(null);
  }, [editingSkill, handleSkillCreated, setSkills]);

  // Get unselected skills for autocomplete
  const unselectedSkills = getUnselectedSkills();

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SkillIcon fontSize="small" />
          Skills {skills.length > 0 && `(${skills.length})`}
        </Typography>
        {allowInlineCreate && (
          <Tooltip title="Create new skill">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateDialog}
              disabled={disabled}
            >
              New Skill
            </Button>
          </Tooltip>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Skills Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Skill Name</TableCell>
              <TableCell width={60}>Color</TableCell>
              <TableCell width={80}>Type</TableCell>
              <TableCell width={80}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Add New Skill Row */}
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell colSpan={3}>
                <Autocomplete
                  size="small"
                  value={selectedSkill}
                  onChange={(event, newValue) => setSelectedSkill(newValue)}
                  options={unselectedSkills}
                  getOptionLabel={(option) => option?.name || ''}
                  loading={availableSkillsLoading}
                  disabled={disabled}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select or search skills..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {availableSkillsLoading ? <CircularProgress size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...restProps } = props;
                    return (
                      <li key={key} {...restProps}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: option.color || '#607D8B'
                            }}
                          />
                          <span>{option.name}</span>
                        </Box>
                      </li>
                    );
                  }}
                />
              </TableCell>
              <TableCell>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleAddSkill}
                  disabled={disabled || !selectedSkill}
                >
                  <AddIcon />
                </IconButton>
              </TableCell>
            </TableRow>

            {/* Loading state */}
            {availableSkillsLoading && skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}

            {/* Empty state */}
            {!availableSkillsLoading && skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 2 }}>
                  No skills added yet. Select from the dropdown above.
                </TableCell>
              </TableRow>
            )}

            {/* Skills list */}
            {skills.map((skill) => (
              <TableRow key={skill.uuid || skill.id}>
                <TableCell>
                  <SkillChip skill={skill} size="small" />
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '4px',
                      backgroundColor: skill.color || '#607D8B',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {skill.type || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {allowInlineCreate && (
                      <Tooltip title="Edit skill">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(skill)}
                          disabled={disabled}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Remove skill">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveSkill(skill.uuid || skill.id)}
                        disabled={disabled}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Skill Create/Edit Dialog */}
      <SkillBridge
        open={skillDialogOpen}
        onClose={() => {
          setSkillDialogOpen(false);
          setEditingSkill(null);
        }}
        onSave={handleSkillSaved}
        skill={editingSkill}
        mode={editingSkill ? 'edit' : 'create'}
        defaultType={skillTypeFilter}
      />
    </Box>
  );
};

export default SkillEditor;
