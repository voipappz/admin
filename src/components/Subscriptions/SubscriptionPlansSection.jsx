import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { usePlans } from '../../hooks/usePlans';
import { formatDate } from '../../utils/dateUtils';
import PlanDialog from '../Plans/PlanDialog'; // Updated path
import { ConfirmDialog } from '../ui';

/**
 * SubscriptionPlansSection Component
 * Displays and manages plans for a specific subscription
 */
const SubscriptionPlansSection = ({ subscriptionId }) => { // Accept subscriptionId prop
  const {
    plans,
    loading,
    error,
    dialogOpen,
    deleteDialogOpen,
    selectedPlan,
    fetchPlans,
    handleOpenDialog,
    handleCloseDialog,
    handleSavePlan,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeletePlan,
  } = usePlans(subscriptionId); // Pass subscriptionId to usePlans
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedPlans = plans.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box> {/* Removed p={3} */}
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}> {/* Reduced mb */}
        <Typography variant="h6" component="h2"> {/* Adjusted variant and component */}
          Plans
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh Plans">
            <IconButton onClick={fetchPlans} disabled={loading} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
            size="small"
          >
            Add Plan
          </Button>
        </Box>
      </Box>

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

      {/* Plans Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid var(--mui-palette-divider)' }}> {/* Added subtle border */}
        <Table size="small"> {/* Made table smaller */}
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Interval</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 2 }}> {/* Reduced py */}
                  <CircularProgress size={20} />
                </TableCell>
              </TableRow>
            ) : paginatedPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 2 }}> {/* Reduced py */}
                  <Typography variant="body2" color="text.secondary">
                    No plans found for this subscription.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedPlans.map((plan) => (
                <TableRow key={plan.id || plan.uuid} hover>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>{plan.notes}</TableCell>
                  <TableCell>{plan.interval}</TableCell>
                  <TableCell>{plan.period}</TableCell>
                  <TableCell>
                    <Chip
                      label={plan.enabled ? 'Yes' : 'No'}
                      size="small"
                      color={plan.enabled ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{formatDate(plan.created_at)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(plan)}
                          disabled={loading}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteDialog(plan)}
                          disabled={loading}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={plans.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </TableContainer>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <PlanDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          onSave={handleSavePlan}
          plan={selectedPlan}
          loading={loading}
          subscriptionId={subscriptionId} // Pass subscriptionId
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleDeletePlan}
          loading={loading}
          title="Delete Plan"
          message={<Typography>Are you sure you want to delete the plan: <strong>{selectedPlan?.name}</strong>?</Typography>}
        />
      )}
    </Box>
  );
};

export default SubscriptionPlansSection;
