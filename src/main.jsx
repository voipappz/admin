import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react";
import { sentryBeforeSend } from './services/sentryZendeskIntegration';
import './index.css'
import App from './App.jsx'

// Only initialize Sentry in production to avoid noisy dev errors and unnecessary Zendesk tickets
const sentryDsn = import.meta.env.VITE_SENTRY_DSN || (import.meta.env.PROD
  ? "https://3efcbcf7c5a85de1c4ac5b501cd812c9@o274939.ingest.us.sentry.io/4510518368337920"
  : null);

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: true,
    environment: import.meta.env.MODE || 'production',
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2, // 20% of transactions in production
    beforeSend: sentryBeforeSend,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
