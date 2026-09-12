import { useEffect, useState } from 'react';
import { Alert, Box, Card, CardContent, CircularProgress, FormControlLabel, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { aclsApi } from '../../services/api/aclsApi';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';

const list = (response) => (Array.isArray(response) ? response : (response?.data || []));

export default function Acls() {
  const { can } = usePermissions();
  const { isRoot } = useAuth();
  // VA_ROOT controls visibility only. Root accounts are intentionally
  // read-only in the admin, regardless of ACL data carried by the token.
  const canWrite = !isRoot && can('acls', 'write');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    aclsApi.getCapabilities('account')
      .then((response) => { if (active) setRows(list(response)); })
      .catch((err) => { if (active) setError(err?.message || 'Unable to load ACL capabilities'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <SecurityIcon color="primary" />
        <Box><Typography variant="h5">ACLs</Typography><Typography variant="body2" color="text.secondary">Access permissions by service, including customers and accounts.</Typography></Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card variant="outlined"><CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box> : (
          <Table size="small"><TableHead><TableRow><TableCell>Service</TableCell><TableCell align="center">Read</TableCell><TableCell align="center">Write</TableCell></TableRow></TableHead><TableBody>
            {rows.map((row) => <TableRow key={row.key}><TableCell sx={{ textTransform: 'capitalize' }}>{row.key.replaceAll('_', ' ')}</TableCell><TableCell align="center"><FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={Boolean(row.read)} disabled={!canWrite} />} label="" /></TableCell><TableCell align="center"><FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={Boolean(row.write)} disabled={!canWrite} />} label="" /></TableCell></TableRow>)}
          </TableBody></Table>
        )}
      </CardContent></Card>
    </Box>
  );
}
