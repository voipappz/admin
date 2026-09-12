import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Phone as PhoneIcon,
  Campaign as AnnouncementIcon,
  Code as CodeIcon,
  CallSplit as CallSplitIcon,
  Queue as QueueIconMui,
  AccountTree as AccountTreeIcon,
  SmartToy as SmartToyIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { bridgeApi } from '../../../services/api/bridgeApi';
import { queuesApi } from '../../../services/api/queuesApi';
import { ivrApi } from '../../../services/api/ivrApi';
import { getAnnouncement } from '../../../services/api/announcementsApi';
import { getVML } from '../../../services/api/vmlsApi';
import { getCallCondition } from '../../../services/api/callConditionsApi';
import { botsApi } from '../../../services/api/botsApi';
import { extensionsApi } from '../../../services/api/extensionsApi';
import { QueueBridge } from '../../Bridges/QueueBridge/QueueBridge';
import { IVRBridge } from '../../Bridges/IVRBridge/IVRBridge';
import { AnnouncementBridge } from '../../Bridges/AnnouncementBridge/AnnouncementBridge.jsx';
import { VMLBridge } from '../../Bridges/VMLBridge/VMLBridge.jsx';
import { CallConditionBridge } from '../../Bridges/CallConditionBridge/CallConditionBridge.jsx';
import { BotBridge } from '../../Bridges/BotBridge/BotBridge';
import { ExtensionBridge } from '../../Bridges/ExtensionBridge/ExtensionBridge';

const RESOURCE_TYPES = [
  { value: 'number', label: 'Number' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'vml', label: 'VML Script' },
  { value: 'call_condition', label: 'Call Condition' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
  { value: 'bot', label: 'Bot' },
  { value: 'conference', label: 'Conference' },
  { value: 'extension', label: 'Device' }
];

// The types offered in the Add Resource dialog come from the server
// (/api/assets/bridge_types) — RESOURCE_TYPES above only supplies the display
// label and icon for whatever the server returns.

// Resource types that can be edited with bridge dialogs (lowercase for comparison)
const EDITABLE_TYPES = ['queue', 'ivr', 'announcement', 'vml', 'call_condition', 'bot', 'extension'];

// Resource types that support inline creation (can create new from user screen)
const CREATABLE_TYPES = ['queue', 'ivr', 'announcement', 'vml', 'call_condition', 'bot', 'extension'];

// Normalize resource type to lowercase for consistent comparison
const normalizeType = (type) => type?.toLowerCase() || '';

// Get icon for resource type (handles case-insensitive matching)
const getResourceIcon = (type) => {
  switch (normalizeType(type)) {
    case 'queue': return <QueueIconMui fontSize="small" />;
    case 'ivr': return <AccountTreeIcon fontSize="small" />;
    case 'extension': return <PhoneIcon fontSize="small" />;
    case 'announcement': return <AnnouncementIcon fontSize="small" />;
    case 'vml': return <CodeIcon fontSize="small" />;
    case 'call_condition': return <CallSplitIcon fontSize="small" />;
    case 'bot': return <SmartToyIcon fontSize="small" />;
    case 'number': return <PhoneIcon fontSize="small" />;
    default: return <SettingsIcon fontSize="small" />;
  }
};

// Get color for resource type chip (handles case-insensitive matching)
const getResourceColor = (type) => {
  switch (normalizeType(type)) {
    case 'queue': return 'primary';
    case 'ivr': return 'secondary';
    case 'extension': return 'success';
    case 'announcement': return 'info';
    case 'vml': return 'warning';
    case 'call_condition': return 'error';
    case 'bot': return 'default';
    case 'number': return 'success';
    default: return 'default';
  }
};

// Get label for resource type (handles case-insensitive matching)
const getResourceTypeLabel = (type) => {
  const normalizedType = normalizeType(type);
  const found = RESOURCE_TYPES.find(rt => rt.value === normalizedType);
  if (found) return found.label;
  // Unknown type from the server — prettify rather than showing the raw key
  return normalizedType
    ? normalizedType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : type;
};

/**
 * ResourcesManager Component
 * Manages user resources (numbers, announcements, IVRs, etc.)
 * Displays resources as chips with edit/delete functionality
 */
const ResourcesManager = ({ resources = [], environmentUuid, onChange, disabled = false }) => {
  // Add resource dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [availableResources, setAvailableResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Resource types come from the server, not a hardcoded list
  const [resourceTypes, setResourceTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  // Edit bridge dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogType, setEditDialogType] = useState(null);
  const [resourceToEdit, setResourceToEdit] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Create bridge dialog state (for inline creation of new resources)
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogType, setCreateDialogType] = useState(null);

  // Load the selectable resource types from the server when the dialog opens
  useEffect(() => {
    if (!addDialogOpen || resourceTypes.length > 0) return;

    let cancelled = false;
    const loadTypes = async () => {
      setLoadingTypes(true);
      try {
        const types = await bridgeApi.getBridgeTypes();
        if (!cancelled) setResourceTypes(Array.isArray(types) ? types : []);
      } catch (error) {
        console.error('Error loading resource types:', error);
        if (!cancelled) setResourceTypes([]);
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    };

    loadTypes();
    return () => { cancelled = true; };
  }, [addDialogOpen, resourceTypes.length]);

  // Load available resources when type changes
  useEffect(() => {
    const loadResources = async () => {
      if (!selectedType || !environmentUuid) {
        setAvailableResources([]);
        return;
      }

      setLoadingResources(true);
      try {
        const response = await bridgeApi.getBridgeResources(selectedType, environmentUuid);
        setAvailableResources(Array.isArray(response) ? response : (response?.data || []));
      } catch (error) {
        console.error('Error loading resources:', error);
        setAvailableResources([]);
      } finally {
        setLoadingResources(false);
      }
    };

    if (addDialogOpen && selectedType) {
      loadResources();
    }
  }, [selectedType, environmentUuid, addDialogOpen]);

  // Reset add dialog state when closed
  useEffect(() => {
    if (!addDialogOpen) {
      setSelectedType('');
      setSelectedResource('');
      setAvailableResources([]);
    }
  }, [addDialogOpen]);

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  // Handle resource selection change (detect "create_new" option)
  const handleResourceSelectChange = (value) => {
    if (value === 'create_new') {
      // Open create dialog for the selected type
      setCreateDialogType(normalizeType(selectedType));
      setCreateDialogOpen(true);
      setSelectedResource(''); // Clear selection
    } else {
      setSelectedResource(value);
    }
  };

  const handleAddResource = () => {
    if (!selectedType || !selectedResource) return;

    // Find the selected resource to get its name
    const resourceObj = availableResources.find(r => r.uuid === selectedResource);
    const newResource = {
      type: selectedType,
      type_uuid: selectedResource,
      name: resourceObj?.name || ''
    };

    // Check if already added
    const alreadyExists = resources.some(
      r => r.type === selectedType && r.type_uuid === selectedResource
    );

    if (!alreadyExists) {
      onChange([...resources, newResource]);
    }

    handleCloseAddDialog();
  };

  // Handle newly created resource from create dialog
  const handleResourceCreated = async (createdResource) => {
    const uuid = createdResource.uuid || createdResource.id;
    const name = createdResource.name || '';

    // Add the newly created resource to the list
    const newResource = {
      type: createDialogType,
      type_uuid: uuid,
      name: name
    };

    // Check if already added
    const alreadyExists = resources.some(
      r => normalizeType(r.type) === createDialogType && r.type_uuid === uuid
    );

    if (!alreadyExists) {
      onChange([...resources, newResource]);
    }

    // Close create dialog
    setCreateDialogOpen(false);
    setCreateDialogType(null);

    // Refresh available resources to include the new one
    if (selectedType && environmentUuid) {
      try {
        const response = await bridgeApi.getBridgeResources(selectedType, environmentUuid);
        setAvailableResources(Array.isArray(response) ? response : (response?.data || []));
        // Auto-select the newly created resource
        setSelectedResource(uuid);
      } catch (error) {
        console.error('Error refreshing resources:', error);
      }
    }

    // Close the add dialog as well since the resource is now added
    handleCloseAddDialog();
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateDialogType(null);
  };

  const handleRemoveResource = (index) => {
    onChange(resources.filter((_, i) => i !== index));
  };

  const handleEditResource = async (resource, index) => {
    const resourceType = normalizeType(resource.type);
    if (!EDITABLE_TYPES.includes(resourceType)) return;

    const resourceUuid = resource.type_uuid || resource.uuid;
    if (!resourceUuid) {
      console.error('No resource UUID found');
      return;
    }

    setEditLoading(true);

    try {
      let fullData;

      // Fetch full resource data from API based on type (using normalized type)
      switch (resourceType) {
        case 'queue': {
          const response = await queuesApi.getQueue(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'ivr': {
          const response = await ivrApi.getIVR(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'announcement': {
          const response = await getAnnouncement(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'vml': {
          const response = await getVML(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'call_condition': {
          const response = await getCallCondition(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'bot': {
          const response = await botsApi.getBot(resourceUuid);
          fullData = response.data || response;
          break;
        }
        case 'extension': {
          const response = await extensionsApi.getExtension(resourceUuid);
          fullData = response.data || response;
          break;
        }
        default:
          fullData = resource;
      }

      // Set resource data and type for editing (use normalized lowercase type)
      setResourceToEdit({
        ...fullData,
        environment_uuid: environmentUuid,
        _index: index // Store index to update the resource after edit
      });
      setEditDialogType(resourceType); // Use normalized type for consistent dialog matching
      setEditDialogOpen(true);
    } catch (error) {
      console.error(`Error loading ${resource.type} for edit:`, error);
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setResourceToEdit(null);
    setEditDialogType(null);
  };

  const handleResourceUpdate = (updatedResource) => {
    // Update the resource name in the list if it changed
    if (resourceToEdit?._index !== undefined) {
      const updatedResources = [...resources];
      updatedResources[resourceToEdit._index] = {
        ...updatedResources[resourceToEdit._index],
        name: updatedResource.name || updatedResources[resourceToEdit._index].name
      };
      onChange(updatedResources);
    }
    handleCloseEditDialog();
  };

  // Get display label for a resource
  const getResourceLabel = (resource) => {
    const typeLabel = getResourceTypeLabel(resource.type);
    const resourceName = resource.name || resource.type_uuid?.substring(0, 8) || 'Unknown';
    return `${typeLabel}: ${resourceName}`;
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Link additional resources to this user (numbers, IVRs, queues, etc.).
      </Typography>

      {/* Resources displayed as chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, minHeight: 32 }}>
        {resources && resources.length > 0 ? (
          resources.map((resource, index) => {
            const isEditable = EDITABLE_TYPES.includes(normalizeType(resource.type));

            return (
              <Chip
                key={`${resource.type}-${resource.type_uuid}-${index}`}
                icon={getResourceIcon(resource.type)}
                label={getResourceLabel(resource)}
                color={getResourceColor(resource.type)}
                variant="outlined"
                size="small"
                disabled={disabled}
                onDelete={disabled ? undefined : () => handleRemoveResource(index)}
                deleteIcon={
                  isEditable && !disabled ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Tooltip title={`Edit ${getResourceTypeLabel(resource.type)}`}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditResource(resource, index);
                          }}
                          sx={{
                            p: 0.25,
                            '&:hover': { color: 'primary.main' }
                          }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveResource(index);
                          }}
                          sx={{
                            p: 0.25,
                            '&:hover': { color: 'error.main' }
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <CloseIcon />
                  )
                }
                sx={{
                  '& .MuiChip-deleteIcon': {
                    display: 'flex',
                    alignItems: 'center'
                  }
                }}
              />
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No additional resources assigned
          </Typography>
        )}

        {/* Add Resource Button */}
        {!disabled && (
          <Tooltip title="Add Resource">
            <IconButton
              size="small"
              onClick={handleOpenAddDialog}
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Loading indicator for edit */}
      {editLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            Loading resource...
          </Typography>
        </Box>
      )}

      {/* Add Resource Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Resource
          <IconButton size="small" onClick={handleCloseAddDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Resource Type Select */}
            <FormControl fullWidth size="small">
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setSelectedResource('');
                }}
                label="Resource Type"
              >
                <MenuItem value="">
                  {loadingTypes ? 'Loading types...' : 'Select type...'}
                </MenuItem>
                {resourceTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getResourceIcon(type)}
                      {getResourceTypeLabel(type)}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Resource Select */}
            <FormControl fullWidth size="small" disabled={!selectedType || loadingResources}>
              <InputLabel>
                {!selectedType ? 'Select type first...' : 'Resource'}
              </InputLabel>
              <Select
                value={selectedResource}
                onChange={(e) => handleResourceSelectChange(e.target.value)}
                label={!selectedType ? 'Select type first...' : 'Resource'}
              >
                <MenuItem value="">
                  {loadingResources ? 'Loading...' : 'Select resource...'}
                </MenuItem>
                {/* Create New option - only for creatable types */}
                {selectedType && CREATABLE_TYPES.includes(normalizeType(selectedType)) && !loadingResources && (
                  <MenuItem value="create_new" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Create New {getResourceTypeLabel(selectedType)}
                    </Box>
                  </MenuItem>
                )}
                {!loadingResources && availableResources.length === 0 && selectedType && (
                  <MenuItem disabled>No {getResourceTypeLabel(selectedType)}s available</MenuItem>
                )}
                {availableResources.map(resource => (
                  <MenuItem key={resource.uuid} value={resource.uuid}>
                    {resource.name || resource.username || resource.uuid}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!environmentUuid && (
              <Typography variant="caption" color="error">
                Please select an environment first to load available resources.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddResource}
            disabled={!selectedType || !selectedResource}
            startIcon={<AddIcon />}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Bridge Dialogs */}
      {editDialogOpen && editDialogType === 'queue' && (
        <QueueBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          queue={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'ivr' && (
        <IVRBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          ivr={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'announcement' && (
        <AnnouncementBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          announcement={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'vml' && (
        <VMLBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          vml={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'call_condition' && (
        <CallConditionBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          callCondition={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'bot' && (
        <BotBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          bot={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {editDialogOpen && editDialogType === 'extension' && (
        <ExtensionBridge
          open={true}
          onClose={handleCloseEditDialog}
          onSave={handleResourceUpdate}
          extension={resourceToEdit}
          mode="edit"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {/* Create Bridge Dialogs - for inline creation of new resources */}
      {createDialogOpen && createDialogType === 'queue' && (
        <QueueBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          queue={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'ivr' && (
        <IVRBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          ivr={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'announcement' && (
        <AnnouncementBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          announcement={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'vml' && (
        <VMLBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          vml={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'call_condition' && (
        <CallConditionBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          callCondition={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'bot' && (
        <BotBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          bot={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}

      {createDialogOpen && createDialogType === 'extension' && (
        <ExtensionBridge
          open={true}
          onClose={handleCloseCreateDialog}
          onSave={handleResourceCreated}
          extension={null}
          mode="create"
          environmentUuid={environmentUuid}
          hideEnvironment={true}
        />
      )}
    </Box>
  );
};

export default ResourcesManager;
