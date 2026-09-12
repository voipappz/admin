import { Chip } from '@mui/material';
import { statusColor, statusLabel } from './statusColors';

/**
 * StatusChip — renders any call/agent status as a themed chip using the
 * shared status->color map. Ported from app (i18n stripped — nimbus-admin
 * has none).
 */
export default function StatusChip({ status, size = 'small', variant = 'filled', ...rest }) {
  return (
    <Chip
      size={size}
      variant={variant}
      color={statusColor(status)}
      label={statusLabel(status)}
      sx={{
        height: 24,
        borderRadius: '6px',
        fontSize: '0.75rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
        ...rest.sx
      }}
      {...rest}
    />
  );
}
