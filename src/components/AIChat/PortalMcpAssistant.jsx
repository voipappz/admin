import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useUserAuth } from '../../context/UserAuthContext';
import { config } from '../../config';

const SUGGESTIONS = [
  'How many calls did I have today?',
  'Do I have abandoned calls?',
  'Show my recent calls',
  'Show errors in the logs',
];

const rpc = async (token, method, params = {}) => {
  const response = await fetch(`${config.apiBaseUrl}/api/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: `${method}-${Date.now()}`, method, params }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(body.error?.message || 'The MCP server did not accept this request.');
  return body.result;
};

const intentFor = (question) => {
  const text = question.toLowerCase();
  if (/abandon|abandod/.test(text)) return { tool: 'calls.summary', answer: 'abandoned' };
  if (text.includes('live call') || text.includes('active call')) return { tool: 'calls.live' };
  if (text.includes('call') && (text.includes('today') || /how many|count|total/.test(text))) {
    return { tool: 'calls.summary', answer: 'total' };
  }
  if (text.includes('call') && /recent|history|last/.test(text)) {
    return { tool: 'calls.history', arguments: { minutes: '1440', limit: '10' } };
  }
  if (/device|extension|phone/.test(text)) return { tool: 'devices.list' };
  if (/log|error|failure|failed/.test(text)) {
    const errorsOnly = /error|failure|failed/.test(text);
    return {
      tool: 'logs.search',
      arguments: { minutes: '1440', limit: '20', ...(errorsOnly ? { severity: 'err' } : {}) },
    };
  }
  return null;
};

const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count === 1 ? singular : pluralForm}`;

const formatAnswer = (intent, data) => {
  if (intent.tool === 'calls.summary') {
    const total = data.total || 0;
    const abandoned = data.abandoned || 0;
    if (intent.answer === 'abandoned') {
      return abandoned > 0
        ? `Yes. You have ${plural(abandoned, 'abandoned call')} today, out of ${plural(total, 'call')} in total.`
        : `No. You have no abandoned calls today. You have ${plural(total, 'call')} in total.`;
    }
    return `You had ${plural(total, 'call')} today: ${data.answered || 0} answered, ${data.no_answer || 0} no answer, and ${abandoned} abandoned.`;
  }

  if (intent.tool === 'calls.history') {
    const calls = data.cdrs || [];
    if (calls.length === 0) return 'I found no recent calls in the last 24 hours.';
    return `I found ${plural(calls.length, 'recent call')}. Open the details below to see them.`;
  }

  if (intent.tool === 'calls.live') {
    const calls = data.calls || [];
    return calls.length === 0 ? 'There are no active calls right now.' : `There are ${plural(calls.length, 'active call')} right now.`;
  }

  if (intent.tool === 'devices.list') {
    const devices = data.devices || [];
    const registered = devices.filter((device) => device.registered).length;
    return `You have ${plural(devices.length, 'device')}; ${registered} ${registered === 1 ? 'is' : 'are'} registered now.`;
  }

  if (intent.tool === 'logs.search') {
    const lines = data.lines || [];
    return lines.length === 0 ? 'I found no matching log errors.' : `I found ${plural(lines.length, 'matching log line')}. Open the details below to inspect them.`;
  }

  return 'The request completed.';
};

// A direct, user-authenticated MCP chat. Questions are mapped to a small,
// deterministic set of read-only tools; no LLM or external AI provider runs.
const PortalMcpAssistant = () => {
  const { token } = useUserAuth();
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi. Ask me about today’s calls, abandoned calls, devices, or recent logs.' },
  ]);
  const messageEndRef = useRef(null);

  const availableTools = useMemo(() => new Set(tools.map((tool) => tool.name)), [tools]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await rpc(token, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'VoipAppz portal', version: '1' },
      });
      const response = await rpc(token, 'tools/list');
      setTools((response.tools || []).filter((tool) => !tool.annotations?.destructiveHint));
    } catch (err) {
      setError(err.message || 'Could not connect to VoipAppz tools.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, running]);

  const ask = async (value) => {
    const trimmed = value.trim();
    if (!trimmed || running) return;

    setQuestion('');
    setError('');
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    const intent = intentFor(trimmed);
    if (!intent) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: 'I can answer about today’s call count, abandoned or recent calls, devices, and logs.',
      }]);
      return;
    }
    if (!availableTools.has(intent.tool)) {
      setMessages((current) => [...current, { role: 'assistant', text: 'That portal tool is not available yet.' }]);
      return;
    }

    setRunning(true);
    try {
      const response = await rpc(token, 'tools/call', {
        name: intent.tool,
        arguments: intent.arguments || {},
      });
      if (response.isError) throw new Error(response.content?.[0]?.text || 'The tool could not complete the request.');
      const data = response.structuredContent || {};
      setMessages((current) => [...current, {
        role: 'assistant',
        text: formatAnswer(intent, data),
        details: ['calls.history', 'logs.search'].includes(intent.tool) ? data : null,
      }]);
    } catch (err) {
      setMessages((current) => [...current, {
        role: 'assistant',
        text: err.message || 'The tool could not complete the request.',
        error: true,
      }]);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="h6">VoipAppz assistant</Typography>
            <Typography variant="caption" color="text.secondary">Direct, user-scoped MCP access</Typography>
          </Box>
          <Chip size="small" color={error ? 'error' : 'success'} label={error ? 'Disconnected' : 'Connected'} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
        {messages.map((message, index) => (
          <Box key={`${message.role}-${index}`} sx={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
            <Paper
              elevation={0}
              sx={{
                maxWidth: '88%',
                px: 1.75,
                py: 1.25,
                bgcolor: message.role === 'user' ? 'primary.main' : message.error ? 'error.lighter' : 'action.hover',
                color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              }}
            >
              <Typography variant="body2">{message.text}</Typography>
              {message.details && (
                <Box component="details" sx={{ mt: 1 }}>
                  <Typography component="summary" variant="caption" sx={{ cursor: 'pointer' }}>View details</Typography>
                  <Box component="pre" sx={{ m: 0, mt: 1, overflow: 'auto', fontSize: '0.7rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(message.details, null, 2)}
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        ))}
        {running && <CircularProgress size={20} sx={{ ml: 1 }} />}
        <Box ref={messageEndRef} />
      </Box>

      <Box sx={{ px: 2, pt: 1.5, pb: 'max(16px, env(safe-area-inset-bottom))', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25, overflowX: 'auto', pb: 0.25 }}>
          {SUGGESTIONS.map((suggestion) => (
            <Chip key={suggestion} label={suggestion} size="small" variant="outlined" onClick={() => ask(suggestion)} sx={{ flexShrink: 0 }} />
          ))}
        </Box>
        <Box component="form" onSubmit={(event) => { event.preventDefault(); ask(question); }} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your calls or logs…"
            disabled={running || Boolean(error)}
          />
          <Button type="submit" variant="contained" disabled={!question.trim() || running || Boolean(error)} aria-label="Send question">
            <SendRoundedIcon />
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default PortalMcpAssistant;
