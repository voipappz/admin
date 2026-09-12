import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  CircularProgress,
  TableSortLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useTickets } from './Tickets';
import TicketsList from './TicketsList/TicketsList';
import TicketDialog from './TicketDialog/TicketDialog';
import TicketDetailView from './TicketDetailView/TicketDetailView';
import { stripedTableRowSx } from '../shared/tableTheme.jsx';
import './Tickets.css';

/**
 * Get color for status chip
 */
const getStatusColor = (status) => {
  switch (status) {
    case 'new':
      return 'info';
    case 'open':
      return 'warning';
    case 'pending':
      return 'default';
    case 'hold':
      return 'secondary';
    case 'solved':
      return 'success';
    case 'closed':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get color for priority chip
 */
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    case 'normal':
      return 'primary';
    case 'low':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/**
 * Tickets Component
 * Main component for support tickets management
 */
const Tickets = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    tickets,
    loading,
    selectedTicket,
    ticketComments,
    dialogOpen,
    detailViewOpen,
    ticketStats,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    filters,
    handleOpenDialog,
    handleCloseDialog,
    handleCreateTicket,
    handleUpdateTicket,
    handleAddComment,
    fetchTicketDetails,
    handleOpenDetailView,
    handleCloseDetailView,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    handleRefresh,
  } = useTickets();

  return (
    <Box
      className="tickets-container"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        p: { xs: 1, sm: 2, md: 3 },
        gap: 2,
        height: '100%',
        width: '100%',
      }}
    >
      {/* Sidebar with Filters */}
      <Box sx={{ display: 'flex', flexShrink: 0 }}>
        <Paper
          className="tickets-sidebar"
          elevation={3}
          sx={{
            width: sidebarOpen ? { xs: '100%', md: '280px' } : '0px',
            height: { xs: 'auto', md: '100%' },
            maxHeight: { xs: '300px', md: 'none' },
            overflowY: 'auto',
            overflowX: 'hidden',
            transition: 'width 0.3s ease',
            display: sidebarOpen ? 'block' : 'none',
          }}
        >
          <TicketsList
            loading={loading}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onAdd={handleOpenDialog}
            onResetFilters={handleResetFilters}
          />
        </Paper>

        {/* Toggle Button */}
        <IconButton
          onClick={() => setSidebarOpen(!sidebarOpen)}
          sx={{
            alignSelf: 'flex-start',
            mt: 1,
            ml: sidebarOpen ? -1.5 : 0,
            bgcolor: 'grey.200',
            '&:hover': {
              bgcolor: 'grey.300',
            },
            width: 28,
            height: 28,
            zIndex: 1,
          }}
          size="small"
          title={sidebarOpen ? 'Hide filters' : 'Show filters'}
        >
          {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Tickets Table */}
        <Paper
          className="tickets-content"
          elevation={3}
          sx={{
            flexGrow: detailViewOpen ? 0 : 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: detailViewOpen ? '300px' : 0,
          }}
        >
          {/* Header with Stats */}
          <Box
            sx={{
              p: 2,
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" component="h2">
              Tickets
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Stats Bar */}
          <Box className="tickets-stats">
            <Chip
              label={`New: ${ticketStats.new || 0}`}
              size="small"
              color="info"
              variant={filters.status === 'new' ? 'filled' : 'outlined'}
            />
            <Chip
              label={`Open: ${ticketStats.open || 0}`}
              size="small"
              color="warning"
              variant={filters.status === 'open' ? 'filled' : 'outlined'}
            />
            <Chip
              label={`Pending: ${ticketStats.pending || 0}`}
              size="small"
              color="default"
              variant={filters.status === 'pending' ? 'filled' : 'outlined'}
            />
            <Chip
              label={`Solved: ${ticketStats.solved || 0}`}
              size="small"
              color="success"
              variant={filters.status === 'solved' ? 'filled' : 'outlined'}
            />
            <Chip
              label={`Total: ${ticketStats.total || 0}`}
              size="small"
              variant="outlined"
              sx={{ ml: 'auto' }}
            />
          </Box>

          {/* Table */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            <TableContainer>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={80}>ID</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'status'}
                        direction={sortBy === 'status' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'priority'}
                        direction={sortBy === 'priority' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('priority')}
                      >
                        Priority
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'updated_at'}
                        direction={sortBy === 'updated_at' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('updated_at')}
                      >
                        Updated
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'created_at'}
                        direction={sortBy === 'created_at' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('created_at')}
                      >
                        Created
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center" width={80}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No tickets found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        hover
                        selected={selectedTicket?.id === ticket.id}
                        sx={{
                          ...stripedTableRowSx,
                          cursor: 'pointer',
                          '&.Mui-selected': {
                            bgcolor: '#e3f2fd !important',
                          },
                        }}
                        onClick={() => handleOpenDetailView(ticket)}
                      >
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            #{ticket.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ticket.status?.charAt(0).toUpperCase() + ticket.status?.slice(1) || 'Unknown'}
                            size="small"
                            color={getStatusColor(ticket.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ticket.subject || 'No subject'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1) || 'Normal'}
                            size="small"
                            color={getPriorityColor(ticket.priority)}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(ticket.updated_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatRelativeTime(ticket.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="View details">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDetailView(ticket)}
                              disabled={loading}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{ borderTop: '1px solid #e0e0e0' }}
            />
          </Box>
        </Paper>

        {/* Ticket Detail View */}
        {detailViewOpen && (
          <Box sx={{ flexGrow: 1, minHeight: 0 }}>
            <TicketDetailView
              ticket={selectedTicket}
              comments={ticketComments}
              loading={loading}
              onClose={handleCloseDetailView}
              onUpdateTicket={handleUpdateTicket}
              onAddComment={handleAddComment}
              onRefresh={fetchTicketDetails}
            />
          </Box>
        )}
      </Box>

      {/* Create Ticket Dialog */}
      <TicketDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleCreateTicket}
        loading={loading}
      />
    </Box>
  );
};

export default Tickets;
