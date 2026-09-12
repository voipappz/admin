import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import { servicesApi } from '../../services/api/servicesApi';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { getEnabledChipProps } from '../../utils/chipStyles';
import ServiceDialog from '../Services/ServiceDialog';

const WorkflowServicePanel = ({ onServiceCreated }) => {
  const { selectedEnvironment } = useCustomerEnvironment();
  const [services, setServices] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuService, setMenuService] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogService, setDialogService] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEnvironment?.uuid) {
        params.environment_uuid = selectedEnvironment.uuid;
      }
      const res = await servicesApi.list(params);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setServices(list);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment?.uuid]);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await servicesApi.getTypes();
      const types = Array.isArray(res) ? res : (res?.types || res?.data || []);
      setServiceTypes(types);
    } catch {
      setServiceTypes([]);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchTypes();
  }, [fetchServices, fetchTypes]);

  // Listen for environment changes
  useEffect(() => {
    const handler = () => fetchServices();
    window.addEventListener('environmentChanged', handler);
    return () => window.removeEventListener('environmentChanged', handler);
  }, [fetchServices]);

  const filtered = services.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleMenuOpen = (event, service) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuService(service);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuService(null);
  };

  const handleCreate = () => {
    setDialogService(null);
    setDialogOpen(true);
  };

  const handleEdit = () => {
    setDialogService(menuService);
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = () => {
    setDeleteTarget(menuService);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleSave = async (data) => {
    setDialogLoading(true);
    try {
      if (dialogService) {
        await servicesApi.update(dialogService.uuid, data);
      } else {
        await servicesApi.create(data);
      }
      setDialogOpen(false);
      setDialogService(null);
      fetchServices();
      onServiceCreated?.();
    } catch (err) {
      console.error('Error saving service:', err);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await servicesApi.delete(deleteTarget.uuid);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchServices();
    } catch (err) {
      console.error('Error deleting service:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Box className="workflow-service-panel">
      {/* Search + Add */}
      <Box sx={{ p: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />,
          }}
          sx={{ flex: 1, '& .MuiInputBase-root': { height: 32, fontSize: 12 } }}
        />
        <IconButton size="small" color="primary" onClick={handleCreate}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Service list */}
      <Box className="workflow-service-list">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="textSecondary" sx={{ p: 2, textAlign: 'center' }}>
            {search ? 'No matching services' : 'No services found'}
          </Typography>
        ) : (
          filtered.map((svc) => (
            <Box key={svc.uuid} className="workflow-service-item">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {svc.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  {svc.type && (
                    <Chip
                      label={svc.type}
                      size="small"
                      sx={{ fontSize: '10px', height: '18px' }}
                    />
                  )}
                  <Chip
                    {...getEnabledChipProps(svc.enabled)}
                    size="small"
                    sx={{ fontSize: '10px', height: '18px' }}
                  />
                </Box>
              </Box>
              <IconButton size="small" onClick={(e) => handleMenuOpen(e, svc)}>
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))
        )}
      </Box>

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteConfirm}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Service create/edit dialog */}
      <ServiceDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogService(null); }}
        onSave={handleSave}
        service={dialogService}
        loading={dialogLoading}
        hookServiceTypes={serviceTypes}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Service</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} /> : null}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowServicePanel;
