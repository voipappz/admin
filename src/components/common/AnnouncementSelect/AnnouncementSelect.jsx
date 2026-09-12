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
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CampaignIcon from '@mui/icons-material/Campaign';
import { AnnouncementBridge } from '../../Bridges/AnnouncementBridge/AnnouncementBridge.jsx';
import { announcementsApi } from '../../../services/api/announcementsApi';

/**
 * AnnouncementSelect Component
 * Reusable announcement selector with inline create/edit functionality
 *
 * Used in: Queue bridges, IVR bridges, DID bridges, etc.
 *
 * Props:
 * - value: String - Selected announcement UUID
 * - onChange: Function - Handler for selection change
 * - announcements: Array - List of announcements (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "Announcement")
 * - required: Boolean - Mark as required
 * - onAnnouncementCreated: Function - Callback after announcement is created
 * - onAnnouncementUpdated: Function - Callback after announcement is updated
 * - fullWidth: Boolean - Full width (default: true)
 * - environmentUuid: String - Environment UUID filter for fetching announcements
 */
const AnnouncementSelect = ({
  value,
  onChange,
  announcements: externalAnnouncements,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'Announcement',
  required = false,
  onAnnouncementCreated,
  onAnnouncementUpdated,
  fullWidth = true,
  environmentUuid
}) => {
  // Internal state for announcements if not provided externally
  const [internalAnnouncements, setInternalAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [selectedAnnouncementLoading, setSelectedAnnouncementLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  // Determine which announcements list to use
  const announcements = externalAnnouncements || internalAnnouncements;
  const loading = externalLoading || announcementsLoading;

  // Fetch announcements on mount if not provided externally
  const fetchAnnouncements = useCallback(async () => {
    if (externalAnnouncements) return;

    setAnnouncementsLoading(true);
    try {
      const params = { per_page: 9999 };
      if (environmentUuid) {
        params.environment_uuid = environmentUuid;
      }

      const response = await announcementsApi.getAnnouncements(params);
      setInternalAnnouncements(Array.isArray(response) ? response : (response.data || []));
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setInternalAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  }, [externalAnnouncements, environmentUuid]);

  useEffect(() => {
    if (!externalAnnouncements) {
      fetchAnnouncements();
    }
  }, [externalAnnouncements, fetchAnnouncements]);

  // Get selected announcement object from value
  const selectedValue = announcements.find(a => a.uuid === value) || null;

  // Handle announcement selection change
  const handleChange = useCallback((event, newValue) => {
    onChange?.(newValue?.uuid || '');
  }, [onChange]);

  // Open create dialog
  const handleCreate = useCallback(() => {
    setDialogMode('create');
    setEditingAnnouncement(null);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback(async () => {
    if (!value) return;

    setSelectedAnnouncementLoading(true);
    try {
      const announcementData = await announcementsApi.getAnnouncement(value);
      setEditingAnnouncement(announcementData);
      setDialogMode('edit');
      setDialogOpen(true);
    } catch (err) {
      console.error('Error fetching announcement for edit:', err);
    } finally {
      setSelectedAnnouncementLoading(false);
    }
  }, [value]);

  // Handle save from AnnouncementBridge
  const handleSave = useCallback(async (savedAnnouncement) => {
    // Refresh announcements list
    if (!externalAnnouncements) {
      await fetchAnnouncements();
    }

    if (dialogMode === 'create') {
      // Select the newly created announcement
      if (savedAnnouncement?.uuid) {
        onChange?.(savedAnnouncement.uuid);
      }
      onAnnouncementCreated?.(savedAnnouncement);
    } else {
      onAnnouncementUpdated?.(savedAnnouncement);
    }

    setDialogOpen(false);
    setEditingAnnouncement(null);
  }, [dialogMode, externalAnnouncements, fetchAnnouncements, onChange, onAnnouncementCreated, onAnnouncementUpdated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
  }, []);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          value={selectedValue}
          onChange={handleChange}
          options={announcements}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => option?.uuid === value?.uuid}
          loading={loading}
          disabled={disabled}
          fullWidth={fullWidth}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              required={required}
              error={error}
              helperText={helperText}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <CampaignIcon sx={{ color: 'action.active', mr: 1 }} />
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <CampaignIcon fontSize="small" sx={{ color: 'action.active' }} />
                  <span>{option.name}</span>
                  {option.type && (
                    <Chip
                      label={option.type}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 'auto' }}
                    />
                  )}
                </Box>
              </li>
            );
          }}
        />

        {/* Edit button - only show when announcement is selected */}
        {value && (
          <Tooltip title="Edit Announcement">
            <span>
              <IconButton
                onClick={handleEdit}
                disabled={disabled || selectedAnnouncementLoading}
                color="primary"
                sx={{ mt: 1 }}
              >
                {selectedAnnouncementLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <EditIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Create button */}
        <Tooltip title="Create New Announcement">
          <span>
            <IconButton
              onClick={handleCreate}
              disabled={disabled}
              color="primary"
              sx={{ mt: 1 }}
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Announcement Dialog */}
      <AnnouncementBridge
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        announcement={editingAnnouncement}
        mode={dialogMode}
        initialEnvironmentUuid={environmentUuid}
      />
    </>
  );
};

export default AnnouncementSelect;
