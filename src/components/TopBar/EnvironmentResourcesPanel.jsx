import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Chip,
  Typography,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PhoneIcon from '@mui/icons-material/Phone';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignIcon from '@mui/icons-material/Campaign';
import { voipResourcesApi } from '../../services/api/voipResourcesApi';
import EnvironmentSparkline from './EnvironmentSparkline';

/**
 * EnvironmentResourcesPanel — Shows resource counts + PBX routing for an environment.
 * Rendered inside the environment popover when an environment row is expanded.
 */
const EnvironmentResourcesPanel = ({ environmentUuid, environmentName }) => {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pbxOpen, setPbxOpen] = useState(false);
  const [PBXRoutingView, setPBXRoutingView] = useState(null);

  const fetchResources = useCallback(async () => {
    if (!environmentUuid) return;
    setLoading(true);
    try {
      const data = await voipResourcesApi.getEnvironmentResources(environmentUuid);
      setResources(data);
    } catch (err) {
      console.error('Failed to fetch environment resources:', err);
      setResources(null);
    } finally {
      setLoading(false);
    }
  }, [environmentUuid]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleOpenPBX = useCallback(async () => {
    // Lazy load PBXRoutingView
    if (!PBXRoutingView) {
      try {
        const mod = await import('../PBXRouting/PBXRoutingView');
        setPBXRoutingView(() => mod.default);
      } catch (err) {
        console.error('Failed to load PBXRoutingView:', err);
        return;
      }
    }
    setPbxOpen(true);
  }, [PBXRoutingView]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (!resources) return null;

  const counts = [
    { label: 'Devices', count: resources.extensions?.length || 0, icon: PhoneIcon, color: '#1976d2' },
    { label: 'Queues', count: resources.queues?.length || 0, icon: HeadsetMicIcon, color: '#7b1fa2' },
    { label: 'IVRs', count: resources.ivrs?.length || 0, icon: DeviceHubIcon, color: '#388e3c' },
    { label: 'Conferences', count: resources.conferences?.length || 0, icon: GroupsIcon, color: '#f57c00' },
    { label: 'Announcements', count: resources.announcements?.length || 0, icon: CampaignIcon, color: '#c62828' },
  ];

  return (
    <>
      <Box sx={{
        px: 1.5, py: 1,
        backgroundColor: 'var(--theme-bg-secondary, #f9fafb)',
        borderTop: '1px solid var(--border-light, #e0e0e0)',
      }}>
        {/* Resource count chips */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
          {counts.map(({ label, count, icon: Icon, color }) => (
            <Chip
              key={label}
              icon={<Icon sx={{ fontSize: '12px !important', color: `${color} !important` }} />}
              label={`${count} ${label}`}
              size="small"
              variant="outlined"
              sx={{
                height: 22,
                fontSize: '0.62rem',
                borderColor: 'var(--border-light, #e0e0e0)',
                '& .MuiChip-icon': { ml: 0.5 }
              }}
            />
          ))}
        </Box>

        {/* Sparkline charts */}
        <EnvironmentSparkline environmentUuid={environmentUuid} />

        {/* PBX Routing button */}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
          <Button
            size="small"
            startIcon={<AccountTreeIcon sx={{ fontSize: 14 }} />}
            onClick={handleOpenPBX}
            sx={{ fontSize: '0.65rem', textTransform: 'none', height: 24, px: 1 }}
            variant="outlined"
          >
            Routing
          </Button>
        </Box>
      </Box>

      {/* PBX Routing Fullscreen Dialog */}
      {PBXRoutingView && (
        <Dialog
          open={pbxOpen}
          onClose={() => setPbxOpen(false)}
          maxWidth="xl"
          fullWidth
          PaperProps={{ sx: { height: '90vh' } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
            <AccountTreeIcon color="primary" />
            <Typography sx={{ flex: 1 }}>Routing — {environmentName}</Typography>
            <IconButton size="small" onClick={() => setPbxOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
            <PBXRoutingView environmentUuid={environmentUuid} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default EnvironmentResourcesPanel;
