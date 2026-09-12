import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  AddCircleOutline as CreditIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import { transactionsApi } from '../../services/api/transactionsApi';

/**
 * TransactionsViewer Component
 * Shows billing transaction history for a subscription
 * Supports manual credit/topup
 */
const TransactionsViewer = ({ subscriptionUuid }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditData, setCreditData] = useState({ amount: '', description: '' });
  const [creditLoading, setCreditLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!subscriptionUuid) return;
    setLoading(true);
    try {
      const result = await transactionsApi.getTransactions({
        subscription_uuid: subscriptionUuid,
        per_page: 100,
        order_by: 'created_at',
        order_type: 'desc'
      });
      setTransactions(Array.isArray(result) ? result : result?.data || []);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [subscriptionUuid]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleAddCredit = async () => {
    if (!creditData.amount || isNaN(parseFloat(creditData.amount))) return;
    setCreditLoading(true);
    try {
      // Amounts are integer UNITS (no currency). Send as-is.
      const amountUnits = Math.round(parseFloat(creditData.amount));
      await transactionsApi.createTransaction({
        subscription_uuid: subscriptionUuid,
        type: 'topup',
        amount: amountUnits,
        notes: creditData.description || 'Manual credit'
      });
      setCreditData({ amount: '', description: '' });
      setShowCreditForm(false);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to create transaction:', err);
    } finally {
      setCreditLoading(false);
    }
  };

  const formatAmount = (amount) => {
    const num = parseInt(amount, 10);
    if (isNaN(num)) return '0 units';
    return `${num >= 0 ? '+' : '-'}${Math.abs(num)} units`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">Transactions</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchTransactions} size="small" title="Refresh" disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            startIcon={<CreditIcon />}
            onClick={() => setShowCreditForm(!showCreditForm)}
            size="small"
            variant="outlined"
            color="success"
          >
            Add Credit
          </Button>
        </Box>
      </Box>

      {showCreditForm && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <TextField
            label="Amount (units)"
            type="number"
            value={creditData.amount}
            onChange={(e) => setCreditData(prev => ({ ...prev, amount: e.target.value }))}
            size="small"
            sx={{ width: 140 }}
          />
          <TextField
            label="Description"
            value={creditData.description}
            onChange={(e) => setCreditData(prev => ({ ...prev, description: e.target.value }))}
            size="small"
            sx={{ flex: 1 }}
            placeholder="e.g. Manual topup"
          />
          <Button
            variant="contained"
            color="success"
            onClick={handleAddCredit}
            disabled={creditLoading || !creditData.amount}
            size="small"
            sx={{ minWidth: 80, height: 40 }}
          >
            {creditLoading ? <CircularProgress size={18} /> : 'Add'}
          </Button>
          <Button
            onClick={() => { setShowCreditForm(false); setCreditData({ amount: '', description: '' }); }}
            size="small"
            sx={{ height: 40 }}
          >
            Cancel
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : transactions.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          No transactions found.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((tx, index) => {
              const amountUnits = parseInt(tx.amount ?? 0, 10);
              const isCredit = amountUnits >= 0;
              return (
                <TableRow key={tx.uuid || index}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="caption">{formatDate(tx.created_at)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        bgcolor: isCredit ? 'success.main' : 'error.main',
                        color: 'white'
                      }}
                    >
                      {tx.entry_type || (isCredit ? 'credit' : 'debit')}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        color: isCredit ? 'success.main' : 'error.main'
                      }}
                    >
                      {formatAmount(amountUnits)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {tx.description || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default TransactionsViewer;
