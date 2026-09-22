import { useId } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

/**
 * ConfirmDialog — the one confirmation dialog.
 *
 * Replaces the local DeleteConfirmDialog every screen used to carry (the same
 * ~40 lines, copied a dozen times, drifting in wording and markup). A screen
 * keeps its own open/loading state and passes what differs: the title, the
 * entity's name, a sentence about consequences.
 *
 *   <ConfirmDialog
 *     open={deleteOpen} loading={deleting}
 *     title="Delete User" entityName={user?.name}
 *     description="This action cannot be undone and will remove all user data."
 *     onClose={closeDelete} onConfirm={doDelete}
 *   />
 *
 * `destructive` (the default) makes the confirm button red. The title and body
 * are wired to the dialog with aria-labelledby/aria-describedby, so a screen
 * reader announces what is being confirmed. MUI already gives Esc -> onClose
 * and focus trapping; Enter confirms. While `loading`, both buttons lock and
 * Esc/backdrop do nothing, so a slow delete cannot be half-cancelled.
 *
 * data-testid="confirm-delete-button" is kept: the Playwright suite clicks it.
 */
const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  entityName,
  description = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  children,
  'data-testid': testId,
}) => {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  const close = (_event, reason) => {
    if (loading) return;
    onClose?.(_event, reason);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !loading && !event.defaultPrevented &&
        event.target?.tagName !== 'TEXTAREA') {
      event.preventDefault();
      onConfirm?.();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      onKeyDown={onKeyDown}
      maxWidth="xs"
      fullWidth
      data-testid={testId}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent id={descId}>
        {message ?? (
          <Typography>
            {entityName
              ? <>Are you sure you want to delete <strong>{entityName}</strong>?</>
              : 'Are you sure you want to continue?'}
          </Typography>
        )}
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        )}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          data-testid="confirm-delete-button"
          onClick={() => onConfirm?.()}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
