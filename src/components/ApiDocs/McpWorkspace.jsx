import { useState } from 'react';
import {
  Box, Chip, Paper, Snackbar, Stack, Typography,
} from '@mui/material';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import { config } from '../../config.js';
import McpConnect from './McpConnect.jsx';
import McpConsole from './McpConsole.jsx';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Admin MCP workspace: connection recipes and the authenticated tool browser. */
export default function McpWorkspace() {
  const [notice, setNotice] = useState('');
  const apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
  const mcpUrl = new URL(`${apiBaseUrl}/api/mcp`, window.location.origin).toString();

  const copyText = async (value, message) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setNotice('Could not copy to the clipboard.');
    }
  };

  return (
    <Box
      data-testid="mcp-workspace"
      sx={{
        flex: '1 1 0', minHeight: 0, overflowY: 'auto',
        p: { xs: 1.5, sm: 2, md: 3 }, width: '100%', maxWidth: 1440, mx: 'auto',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <HubOutlinedIcon color="primary" />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>MCP</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Connect an agent, browse the tools available to this account, and test JSON-RPC requests.
          </Typography>
        </Box>
        <Chip size="small" variant="outlined" label="JSON-RPC 2.0 over POST" />
      </Stack>

      <Paper
        elevation={0}
        sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
      >
        <Typography variant="overline" color="text.secondary">MCP endpoint</Typography>
        <Typography
          data-testid="mcp-workspace-endpoint"
          sx={{ fontFamily: MONO, fontSize: 13, overflowWrap: 'anywhere' }}
        >
          {mcpUrl}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Authorization: Bearer &lt;token&gt; or Basic &lt;email:password&gt;
        </Typography>
        <McpConnect endpointUrl={mcpUrl} copyText={copyText} />
      </Paper>

      <Paper
        elevation={0}
        sx={{ mt: 2, p: { xs: 1.5, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
      >
        <McpConsole active endpointUrl={mcpUrl} />
      </Paper>

      <Snackbar open={Boolean(notice)} autoHideDuration={2500} onClose={() => setNotice('')} message={notice} />
    </Box>
  );
}
