import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Phone as PhoneIcon } from '@mui/icons-material';
import { Z } from '../../../utils/zIndex.js';
import DIDForm from './DIDForm';
import { AnnouncementBridge } from '../../Bridges/AnnouncementBridge/AnnouncementBridge.jsx';
import { VMLBridge } from '../../Bridges/VMLBridge/VMLBridge.jsx';
import { CallConditionBridge } from '../../Bridges/CallConditionBridge/CallConditionBridge.jsx';
import { QueueBridge } from '../../Bridges/QueueBridge/QueueBridge.jsx';
import { IVRBridge } from '../../Bridges/IVRBridge/IVRBridge.jsx';
import { BotBridge } from '../../Bridges/BotBridge/BotBridge.jsx';

/**
 * DIDDialog Component (Backward-compatible wrapper)
 * Wraps DIDForm in a Dialog and implements onDrillDown via bridge dialogs.
 */
const DIDDialog = ({
  did,
  open,
  onClose,
  onSave,
  loading,
  bridgeTypes = [],
  bridgeResources = {},
  didTypes = [],
  onFetchBridgeResources
}) => {
  // Bridge dialog state — replaces the 12+ state vars from old DIDDialog
  const [bridgeDialogType, setBridgeDialogType] = useState(null);
  const [bridgeDialogMode, setBridgeDialogMode] = useState('create');
  const [bridgeDialogData, setBridgeDialogData] = useState(null);
  const [bridgeDialogEnvUuid, setBridgeDialogEnvUuid] = useState('');
  const onResultRef = useRef(null);
  const formRef = useRef(null);

  // DIDForm calls this when user clicks "Create New" or "Edit" on a bridge
  const handleDrillDown = ({ type, mode, data, environmentUuid, onResult }) => {
    setBridgeDialogType(type);
    setBridgeDialogMode(mode);
    setBridgeDialogData(data);
    setBridgeDialogEnvUuid(environmentUuid);
    onResultRef.current = onResult;
  };

  const handleBridgeSave = async (savedData) => {
    if (onResultRef.current) {
      await onResultRef.current(savedData);
      onResultRef.current = null;
    }
    setBridgeDialogType(null);
    setBridgeDialogData(null);
  };

  const handleBridgeClose = () => {
    setBridgeDialogType(null);
    setBridgeDialogData(null);
    onResultRef.current = null;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="did-dialog"
      sx={{ zIndex: Z.L1.DIALOG }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PhoneIcon />
          {did ? 'Edit DID' : 'Create New DID'}
        </Box>
        <Typography className="did-dialog-subtitle">
          Configure routing and properties for this phone number
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <DIDForm
            ref={formRef}
            did={did}
            loading={loading}
            bridgeTypes={bridgeTypes}
            bridgeResources={bridgeResources}
            didTypes={didTypes}
            onFetchBridgeResources={onFetchBridgeResources}
            onSave={onSave}
            onCancel={onClose}
            onDrillDown={handleDrillDown}
            showActions={false}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          onClick={() => formRef.current?.submit()}
        >
          {did ? 'Update DID' : 'Create DID'}
        </Button>
      </DialogActions>

      {/* Bridge Dialogs — opened via onDrillDown */}
      {bridgeDialogType === 'announcement' && (
        <AnnouncementBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          announcement={bridgeDialogData}
          editMode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}

      {bridgeDialogType === 'vml' && (
        <VMLBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          vml={bridgeDialogData}
          mode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}

      {bridgeDialogType === 'call_condition' && (
        <CallConditionBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          callCondition={bridgeDialogData}
          mode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}

      {bridgeDialogType === 'queue' && (
        <QueueBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          queue={bridgeDialogData}
          mode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}

      {bridgeDialogType === 'ivr' && (
        <IVRBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          ivr={bridgeDialogData}
          mode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}

      {bridgeDialogType === 'bot' && (
        <BotBridge
          open={true}
          onClose={handleBridgeClose}
          onSave={handleBridgeSave}
          environmentUuid={bridgeDialogEnvUuid}
          bot={bridgeDialogData}
          mode={bridgeDialogMode}
          hideEnvironment={true}
        />
      )}
    </Dialog>
  );
};

export default DIDDialog;
