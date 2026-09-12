import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ACLDialog from './ACLDialog';
import { useACL } from './useACL';

/**
 * ACLSelect Component
 * Reusable ACL selector with inline create/edit functionality
 *
 * Props:
 * - value: String - Selected ACL UUID
 * - onChange: Function - Handler for selection change
 * - acls: Array - List of ACLs (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "ACL")
 * - required: Boolean - Mark as required
 * - onACLCreated: Function - Callback after ACL is created
 * - onACLUpdated: Function - Callback after ACL is updated
 * - fullWidth: Boolean - Full width (default: true)
 */
const ACLSelect = ({
  value,
  onChange,
  acls: externalACLs,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'ACL',
  required = false,
  onACLCreated,
  onACLUpdated,
  fullWidth = true
}) => {
  // Use internal ACL management if no external ACLs provided
  const {
    acls: internalACLs,
    aclsLoading,
    fetchACLs,
    types,
    typesLoading,
    fetchTypes,
    typeData,
    typeDataLoading,
    fetchTypeData,
    selectedACLLoading,
    fetchACL,
    saving,
    saveError,
    createACL,
    updateACL
  } = useACL();

  // Determine which ACLs list to use
  const acls = externalACLs || internalACLs;
  const loading = externalLoading || aclsLoading;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingACL, setEditingACL] = useState(null);

  // Fetch ACLs on mount if not provided externally
  useEffect(() => {
    if (!externalACLs) {
      fetchACLs();
    }
  }, [externalACLs, fetchACLs]);

  // Get selected ACL object from value
  const selectedValue = acls.find(acl => acl.uuid === value) || null;

  // Handle ACL selection change
  const handleChange = useCallback((event, newValue) => {
    onChange?.(newValue?.uuid || '');
  }, [onChange]);

  // Open create dialog
  const handleCreate = useCallback(async () => {
    setDialogMode('create');
    setEditingACL(null);

    // Fetch types if needed
    if (types.length === 0) {
      await fetchTypes();
    }

    setDialogOpen(true);
  }, [types.length, fetchTypes]);

  // Open edit dialog
  const handleEdit = useCallback(async () => {
    if (!value) return;

    setDialogMode('edit');

    // Fetch ACL data and types in parallel
    const [aclData] = await Promise.all([
      fetchACL(value),
      types.length === 0 ? fetchTypes() : Promise.resolve()
    ]);

    setEditingACL(aclData);
    setDialogOpen(true);
  }, [value, fetchACL, fetchTypes, types.length]);

  // Handle type change in dialog
  const handleTypeChange = useCallback((type) => {
    fetchTypeData(type);
  }, [fetchTypeData]);

  // Handle save
  const handleSave = useCallback(async (aclData) => {
    try {
      if (dialogMode === 'create') {
        const newACL = await createACL(aclData);
        // Select the newly created ACL
        if (newACL?.uuid) {
          onChange?.(newACL.uuid);
        }
        onACLCreated?.(newACL);
      } else {
        await updateACL(editingACL.uuid, aclData);
        onACLUpdated?.(editingACL.uuid);
      }
      setDialogOpen(false);
    } catch {
      // Error is handled by useACL
    }
  }, [dialogMode, editingACL, createACL, updateACL, onChange, onACLCreated, onACLUpdated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    if (!saving) {
      setDialogOpen(false);
      setEditingACL(null);
    }
  }, [saving]);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          value={selectedValue}
          onChange={handleChange}
          options={acls}
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
          renderOption={(props, option) => (
            <li {...props} key={option.uuid}>
              {option.name}
              {option.type && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    color: 'text.secondary',
                    fontSize: '0.85em'
                  }}
                >
                  ({option.type})
                </Box>
              )}
            </li>
          )}
        />

        {/* Edit button - only show when ACL is selected */}
        {value && (
          <Tooltip title="Edit ACL">
            <span>
              <IconButton
                onClick={handleEdit}
                disabled={disabled || selectedACLLoading}
                color="primary"
                sx={{ mt: 1 }}
              >
                {selectedACLLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <EditIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Create button */}
        <Tooltip title="Create New ACL">
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

      {/* ACL Dialog */}
      <ACLDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        mode={dialogMode}
        acl={editingACL}
        types={types}
        typesLoading={typesLoading}
        typeData={typeData}
        typeDataLoading={typeDataLoading}
        onTypeChange={handleTypeChange}
        saving={saving}
        error={saveError}
      />
    </>
  );
};

export default ACLSelect;
