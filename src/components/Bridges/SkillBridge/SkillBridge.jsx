import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import {
  LocalOffer as SkillIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useSkillBridge } from './SkillBridge.js';
import { getContrastTextColor } from '../../../services/api/skillsApi';
import { Z } from '../../../utils/zIndex.js';

/**
 * SkillBridge Component
 * Dialog for creating/editing skills with color picker
 *
 * Props:
 * - open: Boolean - Whether dialog is open
 * - onClose: Function - Close handler
 * - onSave: Function - Save handler (receives skill object)
 * - skill: Object - Existing skill (for edit mode)
 * - mode: 'create' | 'edit' - Dialog mode
 * - defaultType: String - Default skill type (e.g., 'user')
 */
export const SkillBridge = ({
  open,
  onClose,
  onSave,
  skill = null,
  mode = 'create',
  defaultType = 'user'
}) => {
  const {
    formData,
    formErrors,
    handleChange,
    skillTypes,
    skillTypesLoading,
    SKILL_COLORS,
    createSkill,
    updateSkill,
    loading,
    error,
    setError
  } = useSkillBridge(open, skill, mode, defaultType);

  // Handle submit
  const handleSubmit = async () => {
    let result;
    if (mode === 'edit' && skill) {
      result = await updateSkill(skill.uuid || skill.id);
    } else {
      result = await createSkill();
    }

    if (result) {
      onSave(result);
      onClose();
    }
  };

  // Check if form is valid
  const isFormValid = formData.name?.trim() && formData.type && formData.color;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: Z.L3.DIALOG }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SkillIcon sx={{ color: formData.color }} />
            <Typography variant="h6">
              {mode === 'edit' ? 'Edit Skill' : 'Create Skill'}
            </Typography>
          </Box>
          <Button onClick={onClose} size="small" sx={{ minWidth: 'auto' }}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Name Field */}
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
            size="small"
            error={!!formErrors.name}
            helperText={formErrors.name}
            placeholder="Enter skill name"
            disabled={loading}
            autoFocus
          />

          {/* Type Selector */}
          <FormControl
            fullWidth
            size="small"
            required
            error={!!formErrors.type}
            disabled={loading || skillTypesLoading}
          >
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              label="Type"
              onChange={(e) => handleChange('type', e.target.value)}
              MenuProps={{ style: { zIndex: Z.L3.MENU }, PaperProps: { sx: { zIndex: Z.L3.MENU } } }}
            >
              {skillTypes.map(type => (
                <MenuItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </MenuItem>
              ))}
            </Select>
            {formErrors.type && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {formErrors.type}
              </Typography>
            )}
          </FormControl>

          {/* Color Picker */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Color
            </Typography>
            <ToggleButtonGroup
              value={formData.color}
              exclusive
              onChange={(e, newColor) => {
                if (newColor) handleChange('color', newColor);
              }}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5
              }}
            >
              {SKILL_COLORS.map(color => (
                <Tooltip key={color} title={color} arrow>
                  <ToggleButton
                    value={color}
                    disabled={loading}
                    sx={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      minWidth: 36,
                      backgroundColor: color,
                      border: formData.color === color ? '3px solid' : '1px solid',
                      borderColor: formData.color === color ? 'primary.main' : 'rgba(0,0,0,0.2)',
                      '&:hover': {
                        backgroundColor: color,
                        opacity: 0.85
                      },
                      '&.Mui-selected': {
                        backgroundColor: color,
                        '&:hover': {
                          backgroundColor: color,
                          opacity: 0.85
                        }
                      }
                    }}
                  >
                    {formData.color === color && (
                      <Typography sx={{ color: getContrastTextColor(color), fontWeight: 'bold' }}>
                        ✓
                      </Typography>
                    )}
                  </ToggleButton>
                </Tooltip>
              ))}
            </ToggleButtonGroup>
            {formErrors.color && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {formErrors.color}
              </Typography>
            )}
          </Box>

          {/* Preview */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Preview:
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1.5,
                py: 0.5,
                borderRadius: '16px',
                backgroundColor: formData.color,
                color: getContrastTextColor(formData.color),
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
            >
              {formData.name || 'Skill Name'}
            </Box>
          </Box>

          {/* Enabled Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                disabled={loading}
              />
            }
            label="Enabled"
          />

          {/* Notes Field */}
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            placeholder="Optional notes about this skill"
            disabled={loading}
          />

          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SkillIcon />}
        >
          {loading
            ? `${mode === 'edit' ? 'Updating' : 'Creating'}...`
            : mode === 'edit' ? 'Update Skill' : 'Create Skill'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SkillBridge;
