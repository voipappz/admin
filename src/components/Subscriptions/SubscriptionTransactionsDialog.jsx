import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, IconButton, Box,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CloseIcon from '@mui/icons-material/Close';
import { TransactionsViewer } from './SubscriptionDialog/SubscriptionDialog';

/**
 * SubscriptionTransactionsDialog — the subscription's ledger from within the
 * list (like the old wallets view): one row per closed billing period
 * (fee + usage breakdown), straight from GET /api/subscriptions/:id/transactions.
 * Reuses the same TransactionsViewer the edit dialog embeds.
 */
const SubscriptionTransactionsDialog = ({ open, onClose, subscription }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
      <ReceiptLongIcon color="primary" />
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6" component="div">Transactions</Typography>
        <Typography variant="caption" color="text.secondary">
          {subscription?.name} — balance {subscription?.balance ?? 0} units
          ({subscription?.type || 'postpaid'})
        </Typography>
      </Box>
      <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {subscription?.uuid && <TransactionsViewer subscriptionUuid={subscription.uuid} />}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

export default SubscriptionTransactionsDialog;
