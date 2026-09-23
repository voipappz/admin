import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Box,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { ConfirmDialog } from '../ui';
import { useDIDs } from './DIDs';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/jwt';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import DIDWizard, { useWizard } from './DIDWizard/DIDWizard.jsx';
import ImportCSVDialog from '../common/ImportCSVDialog/ImportCSVDialog';
import DuplicateDIDDialog from './DuplicateDIDDialog/DuplicateDIDDialog';
import { IVRBridge } from '../Bridges/IVRBridge/IVRBridge';
import { QueueBridge } from '../Bridges/QueueBridge/QueueBridge';
import { AnnouncementBridge } from '../Bridges/AnnouncementBridge/AnnouncementBridge.jsx';
import { VMLBridge } from '../Bridges/VMLBridge/VMLBridge.jsx';
import { CallConditionBridge } from '../Bridges/CallConditionBridge/CallConditionBridge.jsx';
import { BotBridge } from '../Bridges/BotBridge/BotBridge.jsx';
import { ExtensionBridge } from '../Bridges/ExtensionBridge/ExtensionBridge.jsx';
import { ivrApi } from '../../services/api/ivrApi';
import { queuesApi } from '../../services/api/queuesApi';
import { botsApi } from '../../services/api/botsApi';
import { didsApi } from '../../services/api/routesApi';
import { getAnnouncement } from '../../services/api/announcementsApi';
import { getVML } from '../../services/api/vmlsApi';
import { getCallCondition } from '../../services/api/callConditionsApi';
import { extensionsApi } from '../../services/api/extensionsApi';

const QueuesTopology = lazy(() => import('../Queues/QueuesTopology'));
const PBXRoutingView = lazy(() => import('../PBXRouting/PBXRoutingView'));

/**
 * DIDPanel — self-contained DID management panel for the TopBar popover.
 * Renders a searchable/filterable list with full CRUD via dialogs.
 */
const DIDPanel = () => {
  const { acl } = useAuth();
  const canWrite = hasPermission(acl, 'dids', 'write');
  const { environments, selectedEnvironments } = useCustomerEnvironment();

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // PBX Topology dialog state (global all-DIDs view)
  const [topologyOpen, setTopologyOpen] = useState(false);

  // Per-DID PBX Routing dialog state
  const [routingDID, setRoutingDID] = useState(null);

  // Local search + filter state (lightweight, client-side)
  const [searchValue, setSearchValue] = useState('');
  const [bridgeFilter, setBridgeFilter] = useState('all');

  const {
    dids,
    loading,
    selectedDID,
    dialogOpen,
    deleteDialogOpen,
    didToDelete,
    duplicateDialogOpen,
    didToDuplicate,
    totalCount,
    bridgeTypes,
    bridgeResources,
    didTypes,
    handleOpenDialog,
    handleCloseDialog,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteDID,
    handleOpenDuplicateDialog,
    handleCloseDuplicateDialog,
    handleDuplicateDID,
    fetchDIDs,
    fetchBridgeResources
  } = useDIDs();

  // Wizard state
  const wizardState = useWizard();

  // Bridge from useDIDs dialog state -> wizard
  useEffect(() => {
    if (dialogOpen) {
      const did = selectedDID;
      wizardState.open({
        type: 'did',
        mode: did ? 'edit' : 'create',
        data: did,
        label: did ? `DID: ${did.name || did.number}` : 'Route: (new)',
        environmentUuid: did?.environment_uuid || '',
      });
      handleCloseDialog();
    }
  }, [dialogOpen, selectedDID, wizardState, handleCloseDialog]);

  // Custom save handler for the wizard
  const handleWizardSaveDID = useCallback(async (didData) => {
    const rootView = wizardState.viewStack[0];
    const existingDid = rootView?.data;
    const didUuid = existingDid?.uuid || existingDid?.id;

    const didDataWithEnv = {
      ...didData,
      environment_uuid: didData.environment_uuid || selectedEnvironments?.[0]?.uuid
    };

    if (didUuid) {
      await didsApi.updateDID(didUuid, didDataWithEnv);
    } else {
      await didsApi.createDID(didDataWithEnv);
    }

    fetchDIDs();
  }, [wizardState.viewStack, fetchDIDs, selectedEnvironments]);

  // Listen for environment change events to reload
  useEffect(() => {
    const handler = () => fetchDIDs();
    window.addEventListener('environmentChanged', handler);
    return () => window.removeEventListener('environmentChanged', handler);
  }, [fetchDIDs]);

  // Bridge edit dialog states
  const [bridgeEditDialogOpen, setBridgeEditDialogOpen] = useState(false);
  const [bridgeToEdit, setBridgeToEdit] = useState(null);
  const [bridgeEditType, setBridgeEditType] = useState(null);

  const handleEditBridge = useCallback(async (did) => {
    if (!did.bridge || !did.bridge_type) return;
    const bridgeUuid = did.bridge.uuid || did.bridge.id;
    if (!bridgeUuid) return;

    try {
      let fullBridgeData;
      switch (did.bridge_type) {
        case 'ivr': {
          const r = await ivrApi.getIVR(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'queue': {
          const r = await queuesApi.getQueue(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'announcement': {
          const r = await getAnnouncement(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'vml': {
          const r = await getVML(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'call_condition': {
          const r = await getCallCondition(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'bot': {
          const r = await botsApi.getBot(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        case 'extension': {
          const r = await extensionsApi.getExtension(bridgeUuid);
          fullBridgeData = r.data || r;
          break;
        }
        default:
          fullBridgeData = did.bridge;
      }
      setBridgeToEdit({ ...fullBridgeData, environment_uuid: did.environment_uuid });
      setBridgeEditType(did.bridge_type);
      setBridgeEditDialogOpen(true);
    } catch (err) {
      console.error(`Error loading ${did.bridge_type} for edit:`, err);
    }
  }, []);

  const handleCloseBridgeEdit = useCallback(() => {
    setBridgeEditDialogOpen(false);
    setBridgeToEdit(null);
    setBridgeEditType(null);
  }, []);

  const handleBridgeUpdate = useCallback(async () => {
    await fetchDIDs();
    handleCloseBridgeEdit();
  }, [fetchDIDs, handleCloseBridgeEdit]);

  // Import handlers
  const handleImportCSV = useCallback(async (file, environmentUuid) => {
    return didsApi.importCSV(file, environmentUuid);
  }, []);

  const handleImportSuccess = useCallback(() => {
    fetchDIDs();
  }, [fetchDIDs]);

  // Available bridge types from loaded DIDs (client-side)
  const availableBridgeTypes = useMemo(() => {
    const types = new Set();
    dids.forEach(d => { if (d.bridge_type) types.add(d.bridge_type); });
    return Array.from(types).sort();
  }, [dids]);

  // Client-side search + bridge type filter
  const filteredDIDs = useMemo(() => {
    let list = dids;
    if (bridgeFilter !== 'all') {
      list = list.filter(d => d.bridge_type === bridgeFilter);
    }
    const q = searchValue.toLowerCase().trim();
    if (q) {
      list = list.filter(d =>
        (d.number || '').toLowerCase().includes(q) ||
        (d.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [dids, searchValue, bridgeFilter]);

  return (
    <>
      <Box sx={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Search + action buttons */}
        <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <TextField
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search Routes..."
              variant="outlined"
              size="small"
              fullWidth
              sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', height: 30 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14, color: 'var(--theme-text-secondary)' }} />
                  </InputAdornment>
                ),
                endAdornment: searchValue ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchValue('')} sx={{ p: 0.25 }}>
                      <ClearIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }}
            />
            {canWrite && (
              <Tooltip title="Add Route">
                <IconButton size="small" onClick={() => handleOpenDialog()} disabled={loading} sx={{ p: 0.5, color: 'primary.main' }}>
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Reload">
              <IconButton size="small" onClick={() => fetchDIDs()} disabled={loading} sx={{ p: 0.5 }}>
                <RefreshIcon sx={{ fontSize: 16, color: 'var(--theme-text-secondary)' }} />
              </IconButton>
            </Tooltip>
            {canWrite && (
              <Tooltip title="Import CSV">
                <IconButton size="small" onClick={() => setImportDialogOpen(true)} sx={{ p: 0.5 }}>
                  <UploadIcon sx={{ fontSize: 16, color: 'var(--theme-text-secondary)' }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Bridge type filter chips */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={`All (${dids.length})`}
              size="small"
              variant={bridgeFilter === 'all' ? 'filled' : 'outlined'}
              color={bridgeFilter === 'all' ? 'primary' : 'default'}
              onClick={() => setBridgeFilter('all')}
              sx={{ height: 22, fontSize: '0.65rem', cursor: 'pointer' }}
            />
            {availableBridgeTypes.map(bt => (
              <Chip
                key={bt}
                label={bt}
                size="small"
                variant={bridgeFilter === bt ? 'filled' : 'outlined'}
                color={bridgeFilter === bt ? 'primary' : 'default'}
                onClick={() => setBridgeFilter(bt)}
                sx={{ height: 22, fontSize: '0.65rem', cursor: 'pointer' }}
              />
            ))}
            {(searchValue || bridgeFilter !== 'all') && (
              <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.62rem', ml: 'auto' }}>
                {filteredDIDs.length} matches
              </Typography>
            )}
          </Box>
        </Box>

        {/* DID list */}
        <Box sx={{ borderTop: '1px solid var(--border-light, #e0e0e0)' }} />
        <Box sx={{ flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
          {loading && dids.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={16} /></Box>
          ) : filteredDIDs.length === 0 ? (
            <Box sx={{ px: 1.5, py: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.72rem' }}>
                {dids.length === 0 ? 'No Routes in selected applications' : 'No matching Routes'}
              </Typography>
            </Box>
          ) : (
            filteredDIDs.slice(0, 50).map((did) => (
              <Box
                key={did.uuid || did.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  px: 1.5, py: 0.6,
                  borderBottom: '1px solid var(--border-light, #e0e0e0)',
                  '&:hover': { backgroundColor: 'var(--theme-hover)' },
                }}
              >
                <PhoneIcon sx={{ fontSize: 13, color: did.enabled ? 'var(--accent-primary)' : 'var(--theme-text-secondary)', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500, fontSize: '0.72rem' }}>
                    {did.number || 'No number'}
                  </Typography>
                  {did.name && (
                    <Typography variant="caption" noWrap sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.58rem', display: 'block' }}>
                      {did.name}
                    </Typography>
                  )}
                </Box>
                <Chip label={did.enabled ? 'On' : 'Off'} size="small" color={did.enabled ? 'success' : 'default'} variant={did.enabled ? 'filled' : 'outlined'} sx={{ height: 16, fontSize: '0.52rem', minWidth: 22, flexShrink: 0 }} />
                {did.bridge_type && (
                  <Chip
                    label={did.bridge_type}
                    size="small"
                    variant="outlined"
                    onClick={did.bridge && did.bridge_type !== 'number' && ['ivr', 'queue', 'announcement', 'vml', 'call_condition', 'bot', 'extension'].includes(did.bridge_type) ? () => handleEditBridge(did) : undefined}
                    sx={{
                      height: 16, fontSize: '0.5rem', flexShrink: 0,
                      ...(did.bridge && did.bridge_type !== 'number' && ['ivr', 'queue', 'announcement', 'vml', 'call_condition', 'bot', 'extension'].includes(did.bridge_type)
                        ? { cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }
                        : {}
                      )
                    }}
                  />
                )}
                {canWrite && (
                  <Tooltip title="Edit Route">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(did)}
                      sx={{ p: 0.25, flexShrink: 0 }}
                    >
                      <EditIcon sx={{ fontSize: 13, color: 'var(--theme-text-secondary)' }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canWrite && (
                  <Tooltip title="Duplicate">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDuplicateDialog(did)}
                      sx={{ p: 0.25, flexShrink: 0 }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 13, color: 'var(--theme-text-secondary)' }} />
                    </IconButton>
                  </Tooltip>
                )}
                {canWrite && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDeleteDialog(did)}
                      sx={{ p: 0.25, flexShrink: 0 }}
                    >
                      <DeleteIcon sx={{ fontSize: 13, color: 'var(--theme-text-secondary)' }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Routing">
                  <IconButton
                    size="small"
                    onClick={() => setRoutingDID(did)}
                    sx={{ p: 0.25, flexShrink: 0 }}
                  >
                    <AccountTreeIcon sx={{ fontSize: 13, color: 'var(--theme-text-secondary)' }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))
          )}
          {filteredDIDs.length > 50 && (
            <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: 'block', color: 'var(--theme-text-secondary)', fontSize: '0.6rem' }}>
              Showing 50 of {filteredDIDs.length} — use search to narrow results
            </Typography>
          )}
        </Box>

        {/* Total count footer */}
        {dids.length > 0 && (
          <Box sx={{ px: 1.5, py: 0.5, borderTop: '1px solid var(--border-light, #e0e0e0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.62rem' }}>
              {totalCount} total DIDs
            </Typography>
            {loading && <CircularProgress size={10} />}
          </Box>
        )}
      </Box>

      {/* DID Wizard — rendered as portal (floats above popover) */}
      <DIDWizard
        bridgeTypes={bridgeTypes}
        bridgeResources={bridgeResources}
        didTypes={didTypes}
        onFetchBridgeResources={fetchBridgeResources}
        onSaveDID={handleWizardSaveDID}
        onClose={() => fetchDIDs()}
        loading={loading}
        wizardState={wizardState}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteDID}
        loading={loading}
        title="Delete Route"
        message={<Typography>Are you sure you want to delete DID{' '}
        <strong>{(didToDelete)?.number}</strong>?</Typography>}
        description="This action cannot be undone and will affect call routing."
      />

      {/* Duplicate DID Dialog */}
      <DuplicateDIDDialog
        open={duplicateDialogOpen}
        onClose={handleCloseDuplicateDialog}
        onDuplicate={handleDuplicateDID}
        did={didToDuplicate}
        loading={loading}
      />

      {/* Bridge Edit Dialogs */}
      {bridgeEditDialogOpen && bridgeToEdit && (
        <>
          {bridgeEditType === 'ivr' && (
            <IVRBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} ivr={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'queue' && (
            <QueueBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} queue={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'announcement' && (
            <AnnouncementBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} announcement={bridgeToEdit} editMode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'vml' && (
            <VMLBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} vml={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'call_condition' && (
            <CallConditionBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} callCondition={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'bot' && (
            <BotBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} bot={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
          {bridgeEditType === 'extension' && (
            <ExtensionBridge open={bridgeEditDialogOpen} onClose={handleCloseBridgeEdit} onSave={handleBridgeUpdate} environmentUuid={bridgeToEdit.environment_uuid} extension={bridgeToEdit} mode="edit" hideEnvironment={false} />
          )}
        </>
      )}

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportCSV}
        title="Import Routes from CSV"
        entityName="Routes"
        environments={environments}
        requireEnvironment={true}
        onSuccess={handleImportSuccess}
      />

      {/* PBX Topology Dialog — visual DID → Bridge routing view (all DIDs) */}
      <Dialog
        open={topologyOpen}
        onClose={() => setTopologyOpen(false)}
        fullScreen
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, pr: 1, borderBottom: '1px solid var(--border-light, #e0e0e0)' }}>
          <AccountTreeIcon color="primary" sx={{ fontSize: 22 }} />
          <Typography variant="h6" sx={{ flex: 1 }}>Routing</Typography>
          <IconButton size="small" onClick={() => setTopologyOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={32} /></Box>}>
            <QueuesTopology onEditDID={(didData) => { setTopologyOpen(false); handleOpenDialog(didData); }} />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* PBX Routing Builder — self-contained with DID selector sidebar */}
      <Dialog
        open={!!routingDID}
        onClose={() => setRoutingDID(null)}
        fullScreen
      >
        {routingDID && (
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress size={32} /></Box>}>
            <PBXRoutingView
              didUuid={routingDID.uuid || routingDID.id}
              didInfo={{ number: routingDID.number, name: routingDID.name }}
              onClose={() => setRoutingDID(null)}
            />
          </Suspense>
        )}
      </Dialog>
    </>
  );
};

export default DIDPanel;
