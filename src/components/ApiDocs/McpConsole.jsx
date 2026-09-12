import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import { mcpApi } from '../../services/api/mcpApi';

const MONO_SX = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 };
const MUTED_SX = { color: 'var(--theme-text-secondary)' };
const PANE_SX = {
  ...MONO_SX,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  m: 0,
  p: 1.5,
  borderRadius: 1,
  border: '1px solid var(--theme-border, #e5e7eb)',
  backgroundColor: 'var(--theme-surface-2, rgba(0,0,0,0.03))',
  maxHeight: 420,
  overflow: 'auto',
};

const RAW = '__raw__';

// A starting argument object from the tool's own schema: every required
// property, so the operator sees what the tool needs instead of an empty {}.
function templateFor(tool) {
  const props = tool?.inputSchema?.properties || {};
  const required = tool?.inputSchema?.required || [];
  const template = {};
  required.forEach((key) => { template[key] = props[key]?.type === 'number' ? 0 : ''; });
  return JSON.stringify(template, null, 2);
}

function pretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * The MCP console: speak JSON-RPC to /api/mcp as the logged-in account.
 *
 * Pick a tool (the list comes from tools/list, so a tool added on the API
 * shows up here without a UI change), edit its arguments as JSON, send, and
 * read the answer — the tool's structuredContent when it has one, its text
 * otherwise, and a tool error (isError) as a warning rather than a crash.
 * "Raw JSON-RPC" sends any method (initialize, resources/read, ...) for the
 * cases the picker does not cover. The exchange log keeps the last requests
 * so a sequence — nodes.connected, extensions.list, calls.create — reads as
 * one session.
 *
 * Loads nothing until `active`: the tab is mounted behind display:none like
 * its siblings, and a tools/list on every visit to API Docs is not wanted.
 */
export default function McpConsole({ active = false, endpointUrl = '' }) {
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [toolsError, setToolsError] = useState('');
  const [selected, setSelected] = useState('');
  const [rawMethod, setRawMethod] = useState('initialize');
  const [argsText, setArgsText] = useState('{}');
  const [sending, setSending] = useState(false);
  const [exchanges, setExchanges] = useState([]);

  const selectedTool = useMemo(() => tools.find((t) => t.name === selected), [tools, selected]);

  const loadTools = useCallback(async () => {
    setLoadingTools(true);
    setToolsError('');
    try {
      const list = await mcpApi.listTools();
      setTools(list);
      setSelected((current) => current || list[0]?.name || RAW);
    } catch (err) {
      setToolsError(err?.message || 'Could not list tools');
    } finally {
      setLoadingTools(false);
    }
  }, []);

  useEffect(() => {
    if (active && tools.length === 0 && !loadingTools && !toolsError) loadTools();
  }, [active, tools.length, loadingTools, toolsError, loadTools]);

  const choose = (name) => {
    setSelected(name);
    const tool = tools.find((t) => t.name === name);
    setArgsText(name === RAW ? '{}' : templateFor(tool));
  };

  const send = async () => {
    let args;
    try {
      args = argsText.trim() ? JSON.parse(argsText) : {};
    } catch (err) {
      setExchanges((log) => [{ id: Date.now(), request: argsText, error: `Arguments are not valid JSON: ${err.message}` }, ...log]);
      return;
    }
    const isRaw = selected === RAW;
    const request = isRaw
      ? { method: rawMethod, params: args }
      : { method: 'tools/call', params: { name: selected, arguments: args } };
    const startedAt = performance.now();
    setSending(true);
    try {
      const envelope = await mcpApi.rpc(request.method, request.params);
      setExchanges((log) => [{
        id: Date.now(),
        request,
        envelope,
        ms: Math.round(performance.now() - startedAt),
      }, ...log].slice(0, 30));
    } catch (err) {
      setExchanges((log) => [{ id: Date.now(), request, error: err?.message || 'Request failed', ms: Math.round(performance.now() - startedAt) }, ...log].slice(0, 30));
    } finally {
      setSending(false);
    }
  };

  const latest = exchanges[0];
  const latestResult = latest?.envelope?.result;
  const latestBody = latest?.error
    ? latest.error
    : latest?.envelope?.error
      ? pretty(latest.envelope.error)
      : latestResult?.structuredContent
        ? pretty(latestResult.structuredContent)
        : latestResult?.content?.length
          ? latestResult.content.map((c) => c.text ?? pretty(c)).join('\n')
          : pretty(latestResult ?? latest?.envelope);
  const latestIsToolError = Boolean(latestResult?.isError);
  const latestIsRpcError = Boolean(latest?.envelope?.error);

  return (
    <Box data-testid="mcp-console">
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" useFlexGap flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>MCP console</Typography>
          <Typography variant="body2" sx={MUTED_SX}>
            Call the authenticated MCP server as this account. Every tool wraps the same mediator its REST endpoint uses, scoped to your customer.
          </Typography>
          {endpointUrl && (
            <Typography variant="caption" sx={{ ...MONO_SX, ...MUTED_SX }} data-testid="mcp-console-endpoint">{endpointUrl}</Typography>
          )}
        </Box>
        <Tooltip title="Reload the tool list">
          <span>
            <IconButton size="small" onClick={loadTools} disabled={loadingTools} aria-label="reload tools">
              {loadingTools ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {toolsError && (
        <Alert severity="warning" sx={{ mt: 2 }} action={<Button size="small" onClick={loadTools}>Retry</Button>}>
          {toolsError}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2, mt: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            select
            size="small"
            label="Tool"
            value={selected}
            onChange={(e) => choose(e.target.value)}
            inputProps={{ 'data-testid': 'mcp-console-tool' }}
          >
            {tools.map((tool) => (
              <MenuItem key={tool.name} value={tool.name}>{tool.name}</MenuItem>
            ))}
            <MenuItem value={RAW}>Raw JSON-RPC…</MenuItem>
          </TextField>

          {selected === RAW ? (
            <TextField
              size="small"
              label="Method"
              value={rawMethod}
              onChange={(e) => setRawMethod(e.target.value)}
              inputProps={{ 'data-testid': 'mcp-console-method', style: MONO_SX }}
              helperText="initialize · ping · resources/list · resources/read · tools/list · tools/call"
            />
          ) : (
            selectedTool && (
              <Typography variant="body2" sx={MUTED_SX} data-testid="mcp-console-description">{selectedTool.description}</Typography>
            )
          )}

          <TextField
            multiline
            minRows={6}
            maxRows={16}
            size="small"
            label={selected === RAW ? 'params (JSON)' : 'arguments (JSON)'}
            value={argsText}
            onChange={(e) => setArgsText(e.target.value)}
            inputProps={{ 'data-testid': 'mcp-console-args', style: MONO_SX, spellCheck: false }}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              size="small"
              startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
              onClick={send}
              disabled={sending || !selected}
              data-testid="mcp-console-send"
            >
              Send
            </Button>
            {selectedTool?.inputSchema?.required?.length > 0 && (
              <Typography variant="caption" sx={MUTED_SX}>
                required: {selectedTool.inputSchema.required.join(', ')}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Response</Typography>
            {latest?.ms != null && <Chip size="small" variant="outlined" label={`${latest.ms} ms`} />}
            {latestIsToolError && <Chip size="small" color="warning" label="tool error" data-testid="mcp-console-tool-error" />}
            {latestIsRpcError && <Chip size="small" color="error" label="JSON-RPC error" data-testid="mcp-console-rpc-error" />}
            {latest?.error && <Chip size="small" color="error" label="failed" />}
          </Stack>
          <Box component="pre" sx={PANE_SX} data-testid="mcp-console-response">
            {latest ? latestBody : 'Pick a tool and press Send.'}
          </Box>
        </Box>
      </Box>

      {exchanges.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">Exchange log</Typography>
            <Button size="small" startIcon={<DeleteOutlineIcon />} onClick={() => setExchanges([])}>Clear</Button>
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={1} data-testid="mcp-console-log">
            {exchanges.map((x) => {
              const label = x.request?.params?.name || x.request?.method || 'request';
              const status = x.error ? 'failed' : x.envelope?.error ? 'rpc error' : x.envelope?.result?.isError ? 'tool error' : 'ok';
              return (
                <Box key={x.id} sx={{ ...MONO_SX, display: 'flex', gap: 1.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <Chip size="small" variant="outlined" color={status === 'ok' ? 'success' : status === 'failed' ? 'error' : 'warning'} label={status} />
                  <span>{label}</span>
                  <Typography component="span" variant="caption" sx={MUTED_SX}>
                    {typeof x.request === 'string' ? x.request : pretty(x.request?.params?.arguments ?? x.request?.params ?? {}).replace(/\s+/g, ' ')}
                  </Typography>
                  {x.ms != null && <Typography component="span" variant="caption" sx={MUTED_SX}>{x.ms} ms</Typography>}
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
