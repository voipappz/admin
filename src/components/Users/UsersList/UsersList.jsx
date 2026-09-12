import {
  List,
  ListItem,
  ListItemButton,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { formatDate } from '../../../utils/dateUtils';
import SkillSelect from '../../common/SkillSelect/SkillSelect.jsx';

/**
 * UsersList Component
 * Displays a list of users in the sidebar with filters
 * Filters use search[field] format matching legacy AngularJS pattern
 */
const UsersList = ({
  users,
  loading,
  error,
  selectedUserId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
  environments = [],
  acls = [],
  statuses = [],
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const handleFilterChange = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  // Convert date range to API format: "start_timestamp-end_timestamp"
  const handleDateRangeChange = (field, startDate, endDate) => {
    if (!startDate && !endDate) {
      onFiltersChange({ ...filters, [field]: '' });
      return;
    }
    const start = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : '';
    const end = endDate ? Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000) : '';
    const range = start && end ? `${start}-${end}` : '';
    onFiltersChange({ ...filters, [field]: range });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      email: '',
      enabled: '',
      environment_uuid: '',
      acl_uuid: '',
      status_uuid: '',
      skill_uuids: [],
      created_at: '',
      updated_at: ''
    });
    // Reset local date states
    setCreatedAtStart(null);
    setCreatedAtEnd(null);
    setUpdatedAtStart(null);
    setUpdatedAtEnd(null);
  };

  // Local state for date pickers
  const [createdAtStart, setCreatedAtStart] = useState(null);
  const [createdAtEnd, setCreatedAtEnd] = useState(null);
  const [updatedAtStart, setUpdatedAtStart] = useState(null);
  const [updatedAtEnd, setUpdatedAtEnd] = useState(null);

  if (loading && users.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading users...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const hasActiveFilters = filters.search || filters.email || filters.enabled ||
    filters.environment_uuid || filters.acl_uuid || filters.status_uuid ||
    (filters.skill_uuids && filters.skill_uuids.length > 0) ||
    filters.created_at || filters.updated_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Add New User Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add User
        </Button>
      </Box>

      {/* Filters Section */}
      <Box sx={{ borderBottom: '1px solid #e0e0e0' }}>
        <Accordion
          expanded={filtersExpanded}
          onChange={() => setFiltersExpanded(!filtersExpanded)}
          elevation={0}
          sx={{ '&:before': { display: 'none' }, m: 0 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 }, px: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <FilterListIcon fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                Filters
              </Typography>
              {hasActiveFilters && (
                <Chip
                  label="Active"
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, pt: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Name search */}
              <TextField
                fullWidth
                size="small"
                label="Name"
                placeholder="Search by name..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />

              {/* Email search */}
              <TextField
                fullWidth
                size="small"
                label="Email"
                placeholder="Search by email..."
                value={filters.email || ''}
                onChange={(e) => handleFilterChange('email', e.target.value)}
              />

              {/* Enabled filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Enabled</InputLabel>
                <Select
                  value={filters.enabled || ''}
                  label="Enabled"
                  onChange={(e) => handleFilterChange('enabled', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>

              {/* Environment filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Application</InputLabel>
                <Select
                  value={filters.environment_uuid || ''}
                  label="Application"
                  onChange={(e) => handleFilterChange('environment_uuid', e.target.value)}
                >
                  <MenuItem value="">All Applications</MenuItem>
                  {environments.map((env) => (
                    <MenuItem key={env.uuid || env.id} value={env.uuid || env.id}>
                      {env.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* ACL/Role filter */}
              <FormControl fullWidth size="small">
                <InputLabel>ACL/Role</InputLabel>
                <Select
                  value={filters.acl_uuid || ''}
                  label="ACL/Role"
                  onChange={(e) => handleFilterChange('acl_uuid', e.target.value)}
                >
                  <MenuItem value="">All Roles</MenuItem>
                  {acls.map((acl) => (
                    <MenuItem key={acl.uuid || acl.id} value={acl.uuid || acl.id}>
                      {acl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Status filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status_uuid || ''}
                  label="Status"
                  onChange={(e) => handleFilterChange('status_uuid', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status.uuid || status.id} value={status.uuid || status.id}>
                      {status.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Skills filter */}
              <SkillSelect
                value={filters.skill_uuids || []}
                onChange={(skillUuids) => handleFilterChange('skill_uuids', skillUuids)}
                label="Skills"
                typeFilter="user"
                multiple={true}
                size="small"
                fullWidth
              />

              {/* Created At Date Range */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Created At
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={createdAtStart || ''}
                  onChange={(e) => {
                    setCreatedAtStart(e.target.value);
                    handleDateRangeChange('created_at', e.target.value, createdAtEnd);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={createdAtEnd || ''}
                  onChange={(e) => {
                    setCreatedAtEnd(e.target.value);
                    handleDateRangeChange('created_at', createdAtStart, e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {/* Updated At Date Range */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Updated At
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={updatedAtStart || ''}
                  onChange={(e) => {
                    setUpdatedAtStart(e.target.value);
                    handleDateRangeChange('updated_at', e.target.value, updatedAtEnd);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={updatedAtEnd || ''}
                  onChange={(e) => {
                    setUpdatedAtEnd(e.target.value);
                    handleDateRangeChange('updated_at', updatedAtStart, e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {hasActiveFilters && (
                <Button
                  variant="outlined"
                  size="small"
                  color="inherit"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  fullWidth
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Users Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${users.length}`}
        </Typography>
      </Box>

      {/* Users List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {users.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No users found' : 'No users yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {users.map((user) => {
              const userId = user.id || user.uuid;
              const isSelected = selectedUserId === userId;

              return (
                <ListItem key={userId} disablePadding sx={{ borderBottom: '1px solid #f0f0f0' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(userId)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: '#f5f5f5' },
                      '&.Mui-selected': {
                        bgcolor: '#e3f2fd !important',
                        borderLeft: '3px solid',
                        borderLeftColor: 'primary.main',
                      },
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            flexGrow: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {String(user.name || user.email || 'Unnamed')}
                        </Typography>
                        <Chip
                          label={user.enabled ? 'Active' : 'Inactive'}
                          size="small"
                          color={user.enabled ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {user.email || 'No email'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(user.created_at)}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default UsersList;
