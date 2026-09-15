import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TerminalIcon from '@mui/icons-material/Terminal';
import TuneIcon from '@mui/icons-material/Tune';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { config } from '../../config.js';
import { TourButton } from '../Tour';
import McpConsole from './McpConsole';

const STATUS_COLORS = {
  'operational-incident': 'error',
  'partially-confirmed': 'info',
  'contract-incomplete': 'warning',
  'documentation-drift': 'warning',
  unresolved: 'default',
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

// One colour per verb, the convention every API console uses — the rail is
// scanned by shape and colour long before the path is read.
// Darkened from the usual swagger palette so white 10px text on the pill clears
// WCAG AA (amber at #d97706 is ~2.9:1 against white — it fails).
const METHOD_COLORS = {
  get: '#1d4ed8',
  post: '#15803d',
  put: '#b45309',
  patch: '#b45309',
  delete: '#b91c1c',
  options: '#4b5563',
  head: '#4b5563',
};

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

const publicFetchOptions = {
  credentials: 'omit',
  headers: { Accept: 'application/json' },
};

// Layout hands each screen a fixed-height, overflow:hidden slot, so the screen
// owns its own scrolling. The OpenAPI contract renders far taller than the
// viewport and is unreachable without this.
const SCREEN_SX = {
  flex: '1 1 0',
  minHeight: 0,
  overflowY: 'auto',
  p: { xs: 1, md: 2 },
  color: 'var(--theme-text-primary)',
};

// The MUI theme is light-only, so surfaces follow the app's CSS variables the
// same way the rest of the screens do.
const CARD_SX = {
  p: { xs: 2, md: 3 },
  mb: 2,
  border: '1px solid var(--theme-border, #e5e7eb)',
  borderRadius: 2,
  backgroundColor: 'var(--theme-surface)',
  color: 'inherit',
};

const MUTED_SX = { color: 'var(--theme-text-secondary)' };

const titleCase = (value) => value
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

// swagger-ui ships its own page chrome and light palette. Drop the parts the
// DevZone already provides (its info header, the wrapper padding) and re-point
// surfaces at the admin theme variables so it holds up in dark mode.
const swaggerSx = {
  '& .swagger-ui': { fontFamily: 'inherit', color: 'var(--theme-text-primary)' },
  '& .swagger-ui .information-container': { display: 'none' },
  '& .swagger-ui .wrapper': { padding: 0, maxWidth: '100%' },
  '& .swagger-ui .scheme-container': {
    background: 'transparent',
    boxShadow: 'none',
    padding: '0 0 12px',
    margin: 0,
  },
  '& .swagger-ui .opblock-tag': {
    borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-text-primary)',
    fontSize: '1rem',
  },
  '& .swagger-ui .opblock': {
    border: '1px solid var(--theme-border)',
    borderRadius: '10px',
    boxShadow: 'none',
    background: 'var(--theme-bg-primary)',
  },
  '& .swagger-ui .opblock .opblock-summary': { borderColor: 'var(--theme-border)' },
  '& .swagger-ui .opblock-description-wrapper p, & .swagger-ui .opblock-title_normal p': {
    color: 'var(--theme-text-secondary)',
  },
  '& .swagger-ui .opblock-section-header': {
    background: 'var(--theme-bg-secondary)',
    boxShadow: 'none',
  },
  '& .swagger-ui table thead tr td, & .swagger-ui table thead tr th': {
    borderColor: 'var(--theme-border)',
    color: 'var(--theme-text-secondary)',
  },
  '& .swagger-ui .parameter__name, & .swagger-ui .parameter__type, & .swagger-ui .response-col_status': {
    color: 'var(--theme-text-primary)',
  },
  '& .swagger-ui .model-box, & .swagger-ui section.models': {
    border: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-primary)',
  },
  '& .swagger-ui .btn': { boxShadow: 'none' },
};

/**
 * Developer Zone — the API-owned OpenAPI contract and Agent Skill rendered as a
 * console: quickstart, a searchable operation rail, and try-it-out that borrows
 * the current admin session. Admin credentials never leave the Try It Out call.
 */
export default function ApiDocs() {
  const { access } = useAuth();
  const { isDarkMode } = useThemeMode();
  const [spec, setSpec] = useState(null);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [activeOp, setActiveOp] = useState(null);
  const [integrationStatus, setIntegrationStatus] = useState(null);
  const [error, setError] = useState('');
  const [skillError, setSkillError] = useState('');
  const [notice, setNotice] = useState('');
  const apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
  const swaggerServerUrl = apiBaseUrl || window.location.origin;
  const openApiUrl = `${apiBaseUrl}/tasks/openapi.json`;
  const skillUrl = `${apiBaseUrl}/tasks/agent-skills/use-voipappz-api/SKILL.md`;
  const integrationStatusUrl = `${apiBaseUrl}/tasks/agent-skills/use-voipappz-api/references/integration-status.json`;
  // The one MCP server: JSON-RPC 2.0 over POST, behind a bearer token, with
  // tools scoped to the caller. There is no public, unauthenticated one.
  const mcpToolsUrl = `${apiBaseUrl}/api/mcp`;
  const publicOpenApiUrl = new URL(openApiUrl, window.location.origin).toString();
  const publicSkillUrl = new URL(skillUrl, window.location.origin).toString();
  const publicIntegrationStatusUrl = new URL(integrationStatusUrl, window.location.origin).toString();
  const publicMcpUrl = new URL(mcpToolsUrl, window.location.origin).toString();
  // Public documentation URLs only — the MCP server needs a token, so it is not
  // something to hand an assistant through a pasted prompt.
  const aiPrompt = `Read the VoipAppz Agent Skill at ${publicSkillUrl}, its readiness reference at ${publicIntegrationStatusUrl}, and the live API contract at ${publicOpenApiUrl}. Do not guess billing or provisioning rules, and never ask me to paste credentials into this chat.`;
  const curlExample = `curl -s "${swaggerServerUrl}/api/devices" \
  -H "Authorization: Bearer $TOKEN"`;

  // Swagger UI gates its dark palette on `html.dark-mode`, while the app marks
  // the theme with `data-theme`. Mirror the flag while this screen is mounted so
  // the contract is readable in dark mode, and drop it on unmount.
  useEffect(() => {
    if (!isDarkMode) return undefined;
    document.documentElement.classList.add('dark-mode');
    return () => document.documentElement.classList.remove('dark-mode');
  }, [isDarkMode]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setSkillError('');

    fetch(openApiUrl, publicFetchOptions)
      .then((response) => {
        if (!response.ok) throw new Error(`OpenAPI document returned HTTP ${response.status}`);
        return response.json();
      })
      .then((document) => {
        if (cancelled) return;
        setSpec({
          ...document,
          servers: [{ url: swaggerServerUrl, description: 'Current API environment' }],
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Unable to load the OpenAPI document');
      });

    fetch(integrationStatusUrl, publicFetchOptions)
      .then((response) => {
        if (!response.ok) throw new Error(`Agent Skill status returned HTTP ${response.status}`);
        return response.json();
      })
      .then((document) => {
        if (!cancelled) setIntegrationStatus(document);
      })
      .catch((loadError) => {
        if (!cancelled) setSkillError(loadError.message || 'Unable to load Agent Skill status');
      });

    return () => { cancelled = true; };
  }, [integrationStatusUrl, openApiUrl, swaggerServerUrl]);

  const copyText = (text, message) => {
    if (!navigator.clipboard?.writeText) {
      setNotice('Clipboard access is unavailable in this browser.');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => setNotice(message))
      .catch(() => setNotice('Could not copy to the clipboard.'));
  };

  const copyAiPrompt = () => {
    if (!navigator.clipboard?.writeText) {
      setNotice('Clipboard access is unavailable. Open the Agent Skill and copy its URL.');
      return;
    }

    navigator.clipboard.writeText(aiPrompt)
      .then(() => setNotice('Agent context copied. Paste it into the assistant.'))
      .catch(() => setNotice('Could not copy the prompt. Open the Agent Skill and copy its URL.'));
  };

  const openInAssistant = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    copyAiPrompt();
  };

  // Readiness at a glance: how many topics sit in each status, so the tab can be
  // judged without opening twelve accordions.
  const topics = integrationStatus?.topics || [];
  const statusCounts = useMemo(() => {
    const counts = new Map();
    topics.forEach((topic) => {
      const status = topic.status || 'unresolved';
      const entry = counts.get(status) || { label: topic.status_label || status, count: 0 };
      entry.count += 1;
      counts.set(status, entry);
    });
    return [...counts.entries()].map(([status, entry]) => ({ status, ...entry }));
  }, [topics]);

  // The Skill belongs beside the endpoint it is about, not only in its own tab.
  // Each topic carries the path prefixes it applies to (global ones — the
  // gateway incident — are deliberately left off every operation).
  const topicsForPath = useMemo(() => {
    const scoped = topics.filter((topic) => Array.isArray(topic.paths) && topic.paths.length > 0);
    return (path) => scoped.filter((topic) => topic.paths.some((prefix) => path.startsWith(prefix)));
  }, [topics]);

  // The operation rail, grouped by tag — the contract's own index, so it needs
  // no second source to drift from.
  const groups = useMemo(() => {
    const byTag = new Map();
    Object.entries(spec?.paths || {}).forEach(([path, pathItem]) => {
      Object.entries(pathItem || {}).forEach(([method, operation]) => {
        if (!HTTP_METHODS.includes(method) || !operation) return;
        const explicitTag = operation.tags?.find((tag) => typeof tag === 'string' && tag.trim());
        const segments = path.split('/').filter(Boolean);
        const pathGroup = ['api', 'tasks'].includes(segments[0]) ? segments[1] : segments[0];
        const group = explicitTag || pathGroup || 'other';
        const list = byTag.get(group) || [];
        list.push({
          // Swagger's deep-link id uses the operation tag. Keep it separate
          // from the rail's path-derived fallback group.
          tag: explicitTag || 'default',
          method,
          path,
          operationId: operation.operationId,
          summary: operation.summary,
        });
        byTag.set(group, list);
      });
    });
    return [...byTag.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, operations]) => ({
        tag,
        operations: operations.sort((a, b) => a.path.localeCompare(b.path)),
      }));
  }, [spec]);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map(({ tag, operations }) => ({
        tag,
        operations: operations.filter((op) =>
          `${op.method} ${op.path} ${op.summary || ''} ${tag}`.toLowerCase().includes(needle)),
      }))
      .filter(({ operations }) => operations.length > 0);
  }, [groups, query]);
  const filteredOperationCount = filteredGroups.reduce(
    (total, group) => total + group.operations.length,
    0,
  );

  const operationCount = groups.reduce((total, group) => total + group.operations.length, 0);

  // Jump the reference to an operation: swagger-ui renders each opblock with a
  // deep-link id, so expand it if collapsed and scroll it into view.
  const focusOperation = (op) => {
    setActiveOp(op);
    const id = `operations-${op.tag}-${op.operationId}`;
    let element = document.getElementById(id);
    if (!element && op.operationId) {
      try {
        element = document.querySelector(`[id$="-${op.operationId}"]`);
      } catch {
        element = null;
      }
    }
    if (!element) return;
    if (!element.classList.contains('is-open')) {
      element.querySelector('.opblock-summary')?.click();
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Send exactly what apiService sends on every other screen: the bearer token
  // and nothing else. The API reads the auth mode from the token itself
  // (Endpoints::Base#auth_type) — there is no scope header any more.
  const requestInterceptor = useMemo(() => (request) => {
    if (access) {
      request.headers = {
        ...(request.headers || {}),
        Authorization: `Bearer ${access}`,
      };
    }
    return request;
  }, [access]);

  if (error) {
    return (
      <Box sx={SCREEN_SX}>
        <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>
      </Box>
    );
  }

  if (!spec) {
    return (
      <Box sx={{ ...SCREEN_SX, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
        <CircularProgress size={24} />
        <Typography sx={MUTED_SX}>Loading API documentation…</Typography>
      </Box>
    );
  }

  const quickstart = [
    { label: 'Base URL', value: swaggerServerUrl, copy: 'Base URL copied.' },
    { label: 'Auth header', value: 'Authorization: Bearer <token>', copy: 'Auth header copied.' },
  ];

  const agentResources = [
    {
      title: 'Agent Skill',
      description: 'Portable instructions that teach an assistant how to use VoipAppz safely.',
      href: skillUrl,
      action: 'Open Skill',
      icon: PsychologyOutlinedIcon,
    },
    {
      title: 'Live OpenAPI',
      description: `${operationCount} documented operations from the environment you are signed in to.`,
      href: openApiUrl,
      action: 'Open contract',
      icon: DescriptionOutlinedIcon,
    },
  ];

  // A copyable snippet. Instructions that cannot be copied get retyped wrong.
  const CodeBlock = ({ code, message }) => (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: '10px', bgcolor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border, #e5e7eb)' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        <Box component="pre" sx={{ m: 0, flex: 1, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto', color: 'var(--theme-text-primary)' }}>
          {code}
        </Box>
        <Tooltip title="Copy">
          <IconButton size="small" onClick={() => copyText(code, message)}>
            <ContentCopyIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );

  // Every step is drawn from the contract and the endpoints themselves, not from
  // a hand-kept copy: POST /login (email+password -> {account, token}), the two
  // headers the API reads, and the Pliny {id, message} error body.
  const steps = [
    {
      title: 'Get a token',
      body: 'POST your account email and password. The response carries the JWT you send on every later call. Ten failed attempts from one IP in five minutes returns 429.',
      code: `curl -s "${swaggerServerUrl}/login" \\\n  -H "Content-Type: application/json" \\\n  -d '{"email":"you@example.com","password":"••••••"}'\n\n# => {"account": "...", "token": "eyJhbGci..."}`,
      copy: 'Login request copied.',
    },
    {
      title: 'Call an endpoint',
      body: 'Send the token as a bearer. The API reads the auth mode from the token itself, so no scope header is needed. Basic auth with the same credentials works wherever bearer does.',
      code: curlExample,
      copy: 'Example request copied.',
    },
    {
      title: 'Handle the answer',
      body: 'Success bodies are the serialized resource. Failures are a flat JSON object — id is the machine-readable reason, message the human one. Common statuses: 401 unauthenticated, 406 rejected payload, 429 rate limited.',
      code: '{"id": "not_acceptable", "message": "name is not present"}',
      copy: 'Error shape copied.',
    },
    {
      title: 'Try it from here',
      body: 'Open any operation in the API Reference tab and hit Try It Out. Requests from this page are signed with your current admin session, so you do not need a token to experiment — but you are hitting real data in the current environment.',
    },
    {
      title: 'Hand it to an assistant',
      body: 'Give an MCP-capable agent the /api/mcp endpoint and a token of its own, or use the safe fallback prompt with another assistant. The prompt shares only public documentation URLs — never your session, credentials, or customer data.',
    },
  ];

  return (
    <Box sx={{ ...SCREEN_SX, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Agent-first hero: outcome and connection path before implementation detail. */}
      <Paper
        data-tour="devzone-hero"
        elevation={0}
        sx={{
          ...CARD_SX,
          mb: 0,
          backgroundImage: 'linear-gradient(135deg, var(--accent-primary-alpha-8, rgba(92,107,192,.08)), transparent 60%)',
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PsychologyOutlinedIcon sx={{ color: 'var(--accent-primary)' }} />
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>VoipAppz for AI Agents</Typography>
              <Chip size="small" label={`${operationCount} operations`} variant="outlined" />
              {spec.info?.version && <Chip size="small" label={`v${spec.info.version}`} variant="outlined" />}
            </Stack>
            <Typography variant="body2" sx={{ ...MUTED_SX, mt: 0.75, maxWidth: 720 }}>
              Give an AI agent the live contract, integration guidance, and safety boundaries it needs
              to work with VoipAppz.
            </Typography>
          </Box>

          <Box onClickCapture={() => setTab(0)}>
            <TourButton
              tourId="devzone-guide"
              tooltip="Tour the Developer Zone"
              iconOnly={false}
              label="Quick tour"
              variant="outlined"
            />
          </Box>
        </Stack>


      </Paper>

      {/* Agent onboarding is the default. The implementation reference stays
          mounted so switching tabs preserves Try It Out and accordion state. */}
      <Paper elevation={0} sx={{ ...CARD_SX, p: 0, mb: 0, overflow: 'hidden' }}>
        <Tabs
          data-tour="devzone-tabs"
          value={tab} onChange={(_, next) => setTab(next)}
          variant="scrollable" scrollButtons="auto"
          sx={{ px: { xs: 1, md: 2 }, borderBottom: '1px solid var(--theme-border, #e5e7eb)' }}
        >
          <Tab label="For agents" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="Developer quickstart" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab label="API Reference" sx={{ textTransform: 'none', fontWeight: 600 }} />
          <Tab
            sx={{ textTransform: 'none', fontWeight: 600 }}
            label={(
              <Stack direction="row" alignItems="center" spacing={1}>
                <span>Automation readiness</span>
                {topics.length > 0 && <Chip label={topics.length} size="small" />}
              </Stack>
            )}
          />
          <Tab label="MCP console" sx={{ textTransform: 'none', fontWeight: 600 }} data-testid="tab-mcp-console" />
        </Tabs>

        <Box sx={{ display: tab === 0 ? 'block' : 'none', p: { xs: 2, md: 3 } }}>
          <Box sx={{ maxWidth: 1080 }}>
            <Typography variant="body2" sx={{ ...MUTED_SX, maxWidth: 760 }}>
              Attach this one endpoint with a token of the agent&apos;s own. Its tools see only that account&apos;s customer — and never your session.
            </Typography>

            <Box data-tour="devzone-mcp" sx={{ mt: 2, p: 2, borderRadius: '12px', bgcolor: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5}>
                <TerminalIcon sx={{ color: '#93c5fd', mt: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: '#94a3b8', lineHeight: 1.4 }}>MCP endpoint</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 12.5, wordBreak: 'break-all' }}>
                    {publicMcpUrl}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                    JSON-RPC 2.0 over POST · Authorization: Bearer &lt;token&gt;
                  </Typography>
                </Box>
                <Button
                  variant="contained" size="small" startIcon={<ContentCopyIcon />}
                  onClick={() => copyText(publicMcpUrl, 'MCP endpoint copied.')}
                >
                  Copy endpoint
                </Button>
              </Stack>
            </Box>

            <Accordion
              disableGutters elevation={0}
              sx={{ mt: 1.5, border: '1px solid var(--theme-border, #e5e7eb)', borderRadius: '10px', bgcolor: 'var(--theme-bg-secondary)', color: 'inherit', '&::before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>No MCP client? Use a safe prompt</Typography>
                  <Typography variant="caption" sx={MUTED_SX}>
                    Credential-free fallback for ChatGPT, Claude, or another assistant.
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <CodeBlock code={aiPrompt} message="Fallback agent prompt copied." />
                <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1.5 }}>
                  <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyAiPrompt}>Copy fallback prompt</Button>
                  <Button endIcon={<OpenInNewIcon />} onClick={() => openInAssistant('https://chatgpt.com/')}>Copy prompt + open ChatGPT</Button>
                  <Button endIcon={<OpenInNewIcon />} onClick={() => openInAssistant('https://claude.ai/new')}>Copy prompt + open Claude</Button>
                </Stack>
                <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block', mt: 1.5 }}>
                  These share only the public Skill, readiness and OpenAPI URLs. Your admin session is never included.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Box sx={{ mt: 3 }}>
              <Typography variant="overline" sx={{ ...MUTED_SX, letterSpacing: '.1em' }}>
                Or read them directly
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5, mt: 1.5 }}>
              {agentResources.map((resource) => {
                const ResourceIcon = resource.icon;
                return (
                  <Paper key={resource.title} elevation={0} sx={{ p: 2, border: '1px solid var(--theme-border, #e5e7eb)', borderRadius: '12px', bgcolor: 'var(--theme-bg-primary)', color: 'inherit' }}>
                    <ResourceIcon sx={{ color: 'var(--accent-primary)' }} />
                    <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{resource.title}</Typography>
                      {resource.status && <Chip size="small" variant="outlined" color={resource.statusColor} label={resource.status} />}
                    </Stack>
                    <Typography variant="body2" sx={{ ...MUTED_SX, mt: 0.5, minHeight: { md: 44 } }}>{resource.description}</Typography>
                    <Button
                      component="a" href={resource.href}
                      target="_blank" rel="noreferrer"
                      size="small" endIcon={<OpenInNewIcon />} sx={{ mt: 1 }}
                    >
                      {resource.action}
                    </Button>
                  </Paper>
                );
              })}
            </Box>
            <Box sx={{ mt: 1.5, p: 1.5, border: '1px solid var(--theme-border, #e5e7eb)', borderRadius: '10px', bgcolor: 'var(--theme-bg-secondary)' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>Provisioning schemas</Typography>
                  <Typography variant="body2" sx={MUTED_SX}>
                    The API-owned <Box component="span" sx={{ fontFamily: MONO }}>config/schemas.yaml</Box> catalog is available in Settings.
                  </Typography>
                </Box>
                <Button
                  component="a" href="/settings?section=provisioning-catalog"
                  variant="outlined" size="small" startIcon={<TuneIcon />}
                >
                  Open in Settings
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: tab === 2 ? 'grid' : 'none', gridTemplateColumns: { xs: '1fr', md: '288px minmax(0, 1fr)' } }}>
          {/* Operation rail — search, then tag groups with a coloured verb pill. */}
          <Box
            component="nav"
            aria-label="API operations"
            sx={{
              borderRight: { md: '1px solid var(--theme-border, #e5e7eb)' },
              borderBottom: { xs: '1px solid var(--theme-border, #e5e7eb)', md: 'none' },
              bgcolor: 'var(--theme-bg-secondary)',
              position: { md: 'sticky' }, top: 0, alignSelf: 'start',
              // On a phone the rail sits above the docs, so it has to stay short
              // — 200 operations between the tabs and the reference is a wall.
              maxHeight: { xs: 260, md: 'calc(100vh - 160px)' }, overflowY: 'auto',
              p: 1.5,
            }}
          >
            <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'var(--theme-bg-secondary)', pb: 1 }}>
              <TextField
                size="small" fullWidth placeholder="Search endpoints…"
                value={query} onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter API operations"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block', mt: 0.75, px: 0.25 }}>
                {filteredOperationCount} of {operationCount} operations
              </Typography>
            </Box>

            {filteredGroups.length === 0 && (
              <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block', mt: 2 }}>
                No endpoint matches “{query}”.
              </Typography>
            )}

            {filteredGroups.map(({ tag, operations }) => (
              <Box key={tag} sx={{ mt: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="overline" sx={{ ...MUTED_SX, fontWeight: 700 }}>{titleCase(tag)}</Typography>
                  <Chip size="small" variant="outlined" label={operations.length} sx={{ height: 20, fontSize: 10 }} />
                </Stack>
                <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                  {operations.map((op) => (
                    <Box
                      key={`${op.method}-${op.path}`}
                      role="button"
                      tabIndex={0}
                      aria-current={activeOp?.method === op.method && activeOp?.path === op.path ? 'page' : undefined}
                      onClick={() => focusOperation(op)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') focusOperation(op); }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.5,
                        borderRadius: '6px', cursor: 'pointer',
                        bgcolor: activeOp?.method === op.method && activeOp?.path === op.path
                          ? 'var(--accent-primary-alpha-8, rgba(92,107,192,.08))'
                          : 'transparent',
                        boxShadow: activeOp?.method === op.method && activeOp?.path === op.path
                          ? 'inset 2px 0 var(--accent-primary)'
                          : 'none',
                        '&:hover': { bgcolor: 'var(--accent-primary-alpha-8, rgba(92,107,192,.08))' },
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                          color: '#fff', bgcolor: METHOD_COLORS[op.method] || '#4b5563',
                          borderRadius: '4px', px: 0.5, py: '3px', minWidth: 46, textAlign: 'center',
                        }}
                      >
                        {op.method.toUpperCase()}
                      </Box>
                      <Tooltip title={op.summary || op.path} placement="right">
                        <Typography
                          sx={{
                            fontFamily: MONO, fontSize: 12, flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {op.path}
                        </Typography>
                      </Tooltip>
                      {topicsForPath(op.path).length > 0 && (
                        <Tooltip
                          placement="right"
                          title={`Worth knowing: ${topicsForPath(op.path).map((t) => t.title).join(', ')}`}
                        >
                          <Box
                            component="span"
                            sx={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              bgcolor: (theme) => theme.palette[STATUS_COLORS[
                                topicsForPath(op.path)[0].status] || 'grey']?.main || 'var(--theme-text-secondary)',
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Box sx={{ p: { xs: 1, md: 2 }, minWidth: 0, ...swaggerSx }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {activeOp?.summary || 'API Reference'}
                </Typography>
                <Typography variant="caption" sx={MUTED_SX}>
                  {activeOp
                    ? `${activeOp.method.toUpperCase()} ${activeOp.path}`
                    : 'Choose a grouped operation from the left to inspect and run it.'}
                </Typography>
              </Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
                <Tooltip title={swaggerServerUrl}>
                  <Chip size="small" variant="outlined" label="Current environment" />
                </Tooltip>
                <Chip size="small" color="warning" variant="outlined" label="Try It Out uses live data" />
              </Stack>
            </Stack>
            {/* What we know about the endpoint you just opened — the same notes we
                hand an AI assistant, in front of the person about to call it. */}
            {activeOp && topicsForPath(activeOp.path).length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  mb: 2, p: 1.75, borderRadius: '10px',
                  border: '1px solid var(--theme-border, #e5e7eb)',
                  backgroundColor: 'var(--theme-bg-secondary)', color: 'inherit',
                  // Clicking a rail row scrolls the operation into view, which
                  // would carry these notes off the top of the screen — exactly
                  // when they are being read. Keep them pinned instead.
                  position: 'sticky', top: 8, zIndex: 2,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <PsychologyOutlinedIcon sx={{ fontSize: 18, color: 'var(--accent-primary)' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Worth knowing before you call this
                    </Typography>
                    <Typography variant="caption" sx={MUTED_SX}>
                      <Box component="span" sx={{ fontFamily: MONO }}>{activeOp.method.toUpperCase()} {activeOp.path}</Box>
                      {' '}— notes from our integration guide, so nothing catches you out later.
                    </Typography>
                  </Box>
                  <Tooltip title="Hide these notes">
                    <IconButton size="small" onClick={() => setActiveOp(null)} aria-label="Hide these notes">
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Stack spacing={1.25}>
                  {topicsForPath(activeOp.path).map((topic) => (
                    <Box key={topic.id}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{topic.title}</Typography>
                        <Chip size="small" variant="outlined" label={topic.status_label}
                          color={STATUS_COLORS[topic.status] || 'default'} />
                      </Stack>
                      <Typography variant="caption" sx={{ ...MUTED_SX, display: 'block' }}>{topic.guidance}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            )}
            <SwaggerUI
              spec={spec}
              requestInterceptor={requestInterceptor}
              deepLinking
              docExpansion="list"
              defaultModelsExpandDepth={1}
              defaultModelExpandDepth={1}
              displayRequestDuration
              tryItOutEnabled
              validatorUrl={null}
            />
          </Box>
        </Box>

        {/* Getting started: the path from no credentials to a working call, in
            the order it actually happens. */}
        <Box sx={{ display: tab === 1 ? 'block' : 'none', p: { xs: 2, md: 3 }, maxWidth: 920 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Your first call</Typography>
          <Typography variant="body2" sx={MUTED_SX}>
            Five steps from no credentials to a working integration against this environment.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mt: 2.5 }}>
            {quickstart.map((item) => (
              <Box key={item.label} sx={{ p: 1.25, borderRadius: '10px', border: '1px solid var(--theme-border, #e5e7eb)', bgcolor: 'var(--theme-bg-primary)' }}>
                <Typography variant="overline" sx={{ ...MUTED_SX, lineHeight: 1.6 }}>{item.label}</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography sx={{ fontFamily: MONO, fontSize: 13, flex: 1, wordBreak: 'break-all' }}>{item.value}</Typography>
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={() => copyText(item.value, item.copy)}>
                      <ContentCopyIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
          </Box>
          <CodeBlock code={curlExample} message="Example request copied." />

          <Stack spacing={2.5} sx={{ mt: 2.5 }}>
            {steps.map((step, index) => (
              <Stack key={step.title} direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                    display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
                    color: '#fff', bgcolor: 'var(--accent-primary)',
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{step.title}</Typography>
                  <Typography variant="body2" sx={MUTED_SX}>{step.body}</Typography>
                  {step.code && <CodeBlock code={step.code} message={step.copy} />}
                </Box>
              </Stack>
            ))}
          </Stack>

          <Alert severity="info" sx={{ mt: 3 }}>
            Everything on this page is generated from the API&apos;s own OpenAPI document, so it
            describes the environment you are signed in to — not a static copy.
          </Alert>
        </Box>

        <Box sx={{ display: tab === 3 ? 'block' : 'none', p: { xs: 2, md: 3 } }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" useFlexGap flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Automation readiness</Typography>
              <Typography variant="body2" sx={MUTED_SX}>
                What an agent may automate, what still needs human confirmation, and what it must never assume. The assistant receives exactly the same API-owned guidance.
              </Typography>
            </Box>
            <Button component="a" href={integrationStatusUrl} target="_blank" rel="noreferrer" size="small" endIcon={<OpenInNewIcon />}>
              Raw readiness JSON
            </Button>
          </Stack>

          {statusCounts.length > 0 && (
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1.5 }}>
              {statusCounts.map(({ status, label, count }) => (
                <Chip key={status} size="small" variant="outlined" color={STATUS_COLORS[status] || 'default'} label={`${label} · ${count}`} />
              ))}
            </Stack>
          )}

          {skillError && <Alert severity="warning" sx={{ mt: 2 }}>{skillError}</Alert>}
          {!integrationStatus && !skillError && <CircularProgress size={20} sx={{ mt: 2 }} />}
          <Box sx={{ mt: 2 }}>
            {topics.map((topic) => (
              <Accordion
                key={topic.id}
                disableGutters
                elevation={0}
                sx={{
                  borderTop: '1px solid var(--theme-border, #e5e7eb)',
                  '&::before': { display: 'none' },
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  '& .MuiAccordionSummary-expandIconWrapper': { color: 'var(--theme-text-secondary)' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                    <Typography sx={{ fontWeight: 600 }}>{topic.title}</Typography>
                    <Chip label={topic.status_label} color={STATUS_COLORS[topic.status] || 'default'} size="small" variant="outlined" />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>{topic.question}</Typography>
                  <Typography variant="body2" sx={MUTED_SX}>{topic.guidance}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: tab === 4 ? 'block' : 'none', p: { xs: 2, md: 3 } }}>
          <McpConsole active={tab === 4} endpointUrl={mcpToolsUrl} />
        </Box>
      </Paper>

      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </Box>
  );
}
