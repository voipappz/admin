import React from 'react';
import { Box, Typography, Button, Alert, Paper } from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      errorId: Date.now() // Unique ID for this error instance
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error,
      errorInfo
    });

    // Log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // In production, you could send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error, errorInfo) => {
    // Placeholder for error reporting service integration
    // Could integrate with Sentry, LogRocket, Bugsnag, etc.
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.getUserId()
      };

      // Send to error reporting service
      console.log('Would send to error service:', errorData);
      
      // Example: fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorData) });
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  };

  getUserId = () => {
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id || 'anonymous';
      }
    } catch {
      // Ignore parsing errors
    }
    return 'anonymous';
  };

  handleRefresh = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            backgroundColor: 'var(--mui-palette-surface-muted)'
          }}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              maxWidth: 600, 
              width: '100%',
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" color="error" gutterBottom>
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              We're sorry, but there was an unexpected error. Please try refreshing the page or go back to the home screen.
            </Typography>

            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2">Error ID: {this.state.errorId}</Typography>
              {isDevelopment && this.state.error && (
                <>
                  <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                    {this.state.error.message}
                  </Typography>
                  {this.state.error.stack && (
                    <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {this.state.error.stack}
                    </Typography>
                  )}
                </>
              )}
            </Alert>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                color="primary"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </Box>

            {isDevelopment && this.state.errorInfo && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Component Stack (Development Only):
                </Typography>
                <Alert severity="info">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {this.state.errorInfo.componentStack}
                  </Typography>
                </Alert>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;