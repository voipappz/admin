import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SecretField from '../common/SecretField.jsx';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const MUTED_SX = { color: 'var(--theme-text-secondary)' };
const PLACEHOLDER = 'Basic <email:password, base64>';

/** The Authorization header value for HTTP Basic, or the placeholder until both fields are filled. */
export function basicHeader(email, password) {
  if (!email || !password) return PLACEHOLDER;
  // btoa wants Latin-1; encode so a non-ASCII password does not throw.
  const bytes = new TextEncoder().encode(`${email}:${password}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

/**
 * The recipes an account follows to attach an agent to /api/mcp, with the
 * endpoint and — once the developer has typed them — the credential filled
 * in, so each one is copy, paste, done.
 *
 * The MCP server takes the same Authorization header as every /api route.
 * HTTP Basic `email:password` is the form shown because it needs no OTP round
 * trip and every MCP client can send a static header.
 */
export function connectRecipes(endpointUrl, authorization = PLACEHOLDER) {
  const json = JSON.stringify({
    mcpServers: {
      voipappz: { type: 'http', url: endpointUrl, headers: { Authorization: authorization } },
    },
  }, null, 2);
  return [
    {
      key: 'claude-code',
      label: 'Claude Code',
      note: 'Run this once in your project. Claude Code then lists the voipappz tools on its next start.',
      code: `claude mcp add --transport http voipappz ${endpointUrl} \\\n  --header "Authorization: ${authorization}"`,
    },
    {
      key: 'desktop',
      label: 'Claude Desktop / Cursor',
      note: 'Add this server to the client\'s MCP settings (claude_desktop_config.json, .cursor/mcp.json). Same three fields everywhere.',
      code: json,
    },
    {
      key: 'curl',
      label: 'curl',
      note: 'The same request the Test button sends. A 401 is the credential, not the server.',
      code: `curl -s ${endpointUrl} \\\n  -H "Authorization: ${authorization}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    },
  ];
}

/**
 * Connect your agent, on one screen: type the account's email and password,
 * press Test to see the server answer with its tools, copy the finished config.
 *
 * The credentials live in component state only — never stored, never sent
 * anywhere but the MCP endpoint itself, and never the admin's own session:
 * the agent runs as a credential the account chose and can revoke. The Test
 * request goes through plain fetch, not apiService, so it carries exactly the
 * header the copied config will carry and proves that one, not the session.
 */
export default function McpConnect({ endpointUrl, copyText }) {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const authorization = useMemo(() => basicHeader(email.trim(), password), [email, password]);
  const filled = authorization !== PLACEHOLDER;
  const recipes = useMemo(() => connectRecipes(endpointUrl, authorization), [endpointUrl, authorization]);
  const recipe = recipes[tab];

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      if (response.status === 401) {
        setResult({ ok: false, message: 'The server answered 401: wrong email or password for this account.' });
      } else if (!response.ok) {
        setResult({ ok: false, message: `The server answered HTTP ${response.status}.` });
      } else {
        const envelope = await response.json();
        const tools = envelope?.result?.tools || [];
        setResult({ ok: true, tools: tools.map((t) => t.name) });
      }
    } catch (err) {
      setResult({ ok: false, message: err?.message || 'Could not reach the MCP endpoint.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box data-testid="mcp-connect" sx={{ mt: 1.5, border: '1px solid var(--theme-border, #e5e7eb)', borderRadius: '10px', bgcolor: 'var(--theme-bg-secondary)' }}>
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>Connect your agent</Typography>
        <Typography variant="caption" sx={MUTED_SX}>
          Type the account&apos;s email and password, press Test, copy the config. Nothing is stored; the credential goes only to the MCP endpoint.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ px: 2, mt: 1.5 }}>
        <TextField
          size="small" label="Account email" value={email} autoComplete="off"
          onChange={(e) => { setEmail(e.target.value); setResult(null); }}
          inputProps={{ 'data-testid': 'mcp-connect-email' }} sx={{ flex: 1 }}
        />
        <SecretField
          size="small" label="Password" value={password}
          onChange={(e) => { setPassword(e.target.value); setResult(null); }}
          inputProps={{ 'data-testid': 'mcp-connect-password' }} sx={{ flex: 1 }}
        />
        <Button
          variant="contained" size="small" onClick={test} disabled={!filled || testing}
          startIcon={testing ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          data-testid="mcp-connect-test"
        >
          Test
        </Button>
      </Stack>

      {result && (
        <Box sx={{ px: 2, mt: 1 }}>
          {result.ok ? (
            <Alert severity="success" data-testid="mcp-connect-ok">
              Connected. {result.tools.length} tools for this account:
              <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>
                {result.tools.map((name) => <Chip key={name} size="small" variant="outlined" label={name} sx={{ fontFamily: MONO }} />)}
              </Stack>
            </Alert>
          ) : (
            <Alert severity="warning" data-testid="mcp-connect-fail">{result.message}</Alert>
          )}
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ px: 1, mt: 0.5, minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
      >
        {recipes.map((r) => <Tab key={r.key} label={r.label} data-testid={`mcp-connect-tab-${r.key}`} />)}
      </Tabs>
      <Box sx={{ px: 2, pb: 2 }}>
        <Typography variant="body2" sx={{ ...MUTED_SX, mt: 1 }}>{recipe.note}</Typography>
        <Box sx={{ mt: 1, p: 1.5, borderRadius: '10px', bgcolor: 'var(--theme-bg-primary)', border: '1px solid var(--theme-border, #e5e7eb)' }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box component="pre" data-testid="mcp-connect-code" sx={{ m: 0, flex: 1, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto', color: 'var(--theme-text-primary)' }}>
              {recipe.code}
            </Box>
            <Tooltip title={filled ? 'Copy, ready to paste' : 'Copy (fill in the credential first for a ready-to-paste config)'}>
              <IconButton size="small" aria-label={`copy ${recipe.label} config`} onClick={() => copyText(recipe.code, `${recipe.label} config copied.`)}>
                <ContentCopyIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block', mt: 1 }}>
          {filled
            ? 'This config carries the account’s credential. Paste it into the client, not into a chat.'
            : 'Tools answer only for the account whose credential the agent carries. Your admin session is never used.'}
        </Typography>
      </Box>
    </Box>
  );
}
