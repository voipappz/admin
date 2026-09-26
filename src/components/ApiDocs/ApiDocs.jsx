import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, CircularProgress, Stack, Typography,
} from '@mui/material';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import { config } from '../../config.js';

const publicFetchOptions = {
  credentials: 'omit',
  headers: { Accept: 'application/json' },
};

const swaggerSx = {
  flex: '1 1 0', minHeight: 0, overflowY: 'auto', p: { xs: 1.5, md: 2.5 },
  color: 'var(--theme-text-primary)',
  '& .swagger-ui': { fontFamily: 'inherit', color: 'var(--theme-text-primary)' },
  '& .swagger-ui .information-container': { display: 'none' },
  '& .swagger-ui .wrapper': { padding: 0, maxWidth: '100%' },
  '& .swagger-ui .scheme-container': {
    background: 'transparent', boxShadow: 'none', padding: '0 0 12px', margin: 0,
  },
  '& .swagger-ui .opblock-tag': {
    borderBottom: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)', fontSize: '1rem',
  },
  '& .swagger-ui .opblock': {
    border: '1px solid var(--theme-border)', borderRadius: '10px', boxShadow: 'none',
    background: 'var(--theme-bg-primary)',
  },
  '& .swagger-ui .opblock .opblock-summary': { borderColor: 'var(--theme-border)' },
  '& .swagger-ui .opblock-description-wrapper p, & .swagger-ui .opblock-title_normal p': {
    color: 'var(--theme-text-secondary)',
  },
  '& .swagger-ui .opblock-section-header': {
    background: 'var(--theme-bg-secondary)', boxShadow: 'none',
  },
  '& .swagger-ui table thead tr td, & .swagger-ui table thead tr th': {
    borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)',
  },
  '& .swagger-ui .parameter__name, & .swagger-ui .parameter__type, & .swagger-ui .response-col_status': {
    color: 'var(--theme-text-primary)',
  },
  '& .swagger-ui .model-box, & .swagger-ui section.models': {
    border: '1px solid var(--theme-border)', background: 'var(--theme-bg-primary)',
  },
  '& .swagger-ui .btn': { boxShadow: 'none' },
};

/** Swagger is the DevZone screen. MCP lives in its dedicated workspace. */
export default function ApiDocs() {
  const { access } = useAuth();
  const { isDarkMode } = useThemeMode();
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState('');
  const apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
  const serverUrl = apiBaseUrl || window.location.origin;
  const openApiUrl = `${apiBaseUrl}/tasks/openapi.json`;

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
    return () => document.documentElement.classList.remove('dark-mode');
  }, [isDarkMode]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetch(openApiUrl, publicFetchOptions)
      .then((response) => {
        if (!response.ok) throw new Error(`OpenAPI document returned HTTP ${response.status}`);
        return response.json();
      })
      .then((document) => {
        if (!cancelled) setSpec({
          ...document,
          servers: [{ url: serverUrl, description: 'Current API environment' }],
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Unable to load the OpenAPI document');
      });
    return () => { cancelled = true; };
  }, [openApiUrl, serverUrl]);

  const requestInterceptor = useMemo(() => (request) => {
    if (access) request.headers = { ...(request.headers || {}), Authorization: `Bearer ${access}` };
    return request;
  }, [access]);

  return (
    <Box sx={swaggerSx} data-testid="swagger-screen">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>API Reference</Typography>
          <Typography variant="body2" color="text.secondary">
            Explore the live VoipAppz contract and try requests against this environment.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && !spec && (
        <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={30} aria-label="Loading API reference" />
        </Box>
      )}
      {spec && (
        <SwaggerUI
          spec={spec} requestInterceptor={requestInterceptor} deepLinking docExpansion="list"
          defaultModelsExpandDepth={1} defaultModelExpandDepth={1} displayRequestDuration
          tryItOutEnabled validatorUrl={null}
        />
      )}

    </Box>
  );
}
