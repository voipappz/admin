import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Box, Typography } from '@mui/material';
import {
  Phone as PhoneIcon,
  Headset as HeadsetIcon,
  AccessTime as ClockIcon,
  AccountTree as IvrIcon,
  Campaign as AnnouncementIcon,
  Code as VmlIcon,
  SmartToy as BotIcon,
  SettingsPhone as ExtensionIcon,
  Groups as ConferenceIcon,
  Login as UserLoginIcon,
  CellTower as ProviderIcon,
  Receipt as SubscriptionIcon,
  RequestQuote as TariffIcon,
} from '@mui/icons-material';

export const TYPE_CONFIG = {
  // Entry
  did:            { icon: PhoneIcon, color: '#1976d2', label: 'DID', shape: 'entry' },
  // Routing / decision
  queue:          { icon: HeadsetIcon, color: '#2e7d32', label: 'Queue', shape: 'routing' },
  call_condition: { icon: ClockIcon, color: '#ed6c02', label: 'Call Condition', shape: 'routing' },
  ivr:            { icon: IvrIcon, color: '#7b1fa2', label: 'IVR Menu', shape: 'routing' },
  // Leaf / terminal
  announcement:   { icon: AnnouncementIcon, color: '#0288d1', label: 'Announcement', shape: 'leaf' },
  vml:            { icon: VmlIcon, color: '#616161', label: 'VML', shape: 'leaf' },
  bot:            { icon: BotIcon, color: '#d32f2f', label: 'Bot', shape: 'leaf' },
  extension:      { icon: ExtensionIcon, color: '#00796b', label: 'Device', shape: 'leaf' },
  number:         { icon: PhoneIcon, color: '#455a64', label: 'Number', shape: 'leaf' },
  conference:     { icon: ConferenceIcon, color: '#6a1b9a', label: 'Conference', shape: 'leaf' },
  user_login:     { icon: UserLoginIcon, color: '#37474f', label: 'User Login', shape: 'leaf' },
  // Infrastructure / billing
  provider:       { icon: ProviderIcon, color: '#0d47a1', label: 'Provider', shape: 'infra' },
  subscription:   { icon: SubscriptionIcon, color: '#4a148c', label: 'Subscription', shape: 'infra' },
  tariff:         { icon: TariffIcon, color: '#e65100', label: 'Tariff', shape: 'infra' },
};

const SHAPE_RADIUS = {
  entry:   '8px',
  routing: '12px',
  leaf:    '20px',
  infra:   '4px',
};

/**
 * Shared wrapper for all PBX routing nodes.
 * Provides: colored header band, shape variant, target handle at top.
 * Children define the interior content and source handles.
 */
const PBXBaseNode = memo(({ type, width = 340, selected, onClick, children }) => {
  const config = TYPE_CONFIG[type] || { icon: PhoneIcon, color: 'var(--mui-palette-text-secondary)', label: type, shape: 'entry' };
  const Icon = config.icon;
  const borderRadius = SHAPE_RADIUS[config.shape] || '8px';

  return (
    <Paper
      elevation={selected ? 6 : 1}
      onClick={onClick}
      className="pbx-node"
      sx={{
        width,
        borderRadius,
        overflow: 'visible',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, outline-color 0.2s, transform 0.2s',
        outline: selected ? `2px solid ${config.color}` : '2px solid transparent',
        '&:hover': onClick ? { boxShadow: 6 } : undefined,
        position: 'relative',
      }}
    >
      {/* Target handle (top center) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: config.color,
          border: '2px solid #fff',
          top: -4,
        }}
      />

      {/* Full-width colored header band */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.5, py: 0.75,
        background: config.color,
        borderRadius: `${borderRadius} ${borderRadius} 0 0`,
      }}>
        <Icon sx={{ fontSize: 15, color: '#fff' }} />
        <Typography
          variant="overline"
          sx={{
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1,
            lineHeight: 1.4,
            fontSize: '0.65rem',
          }}
        >
          {config.label}
        </Typography>
      </Box>

      {/* Content area with subtle body tint */}
      <Box sx={{
        px: 1.5, py: 1,
        background: `${config.color}0D`,
        borderRadius: `0 0 ${borderRadius} ${borderRadius}`,
      }}>
        {children}
      </Box>
    </Paper>
  );
});

PBXBaseNode.displayName = 'PBXBaseNode';

export default PBXBaseNode;
