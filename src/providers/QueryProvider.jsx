import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Determine if a failed query should be retried.
 * NEVER retry on:
 * - 500 Internal Server Error (permanent server issues)
 * - 502 Bad Gateway (server down)
 * - 503 Service Unavailable (server overloaded)
 * - 429 Rate Limited (client should back off)
 * - 401/403 Authentication errors
 *
 * The apiService already has circuit breaker and retry logic,
 * so React Query should only retry on transient network errors.
 */
const shouldRetryQuery = (failureCount, error) => {
  // Max 2 retries (let apiService handle more sophisticated retry logic)
  if (failureCount >= 2) {
    return false;
  }

  // Check for error status
  const status = error?.status || error?.response?.status;

  // NEVER retry on these status codes
  if (status) {
    const noRetryStatuses = [400, 401, 403, 404, 406, 422, 429, 500, 502, 503];
    if (noRetryStatuses.includes(status)) {
      console.log(`[QueryProvider] NOT retrying: status ${status}`);
      return false;
    }
  }

  // Check error message for known server errors
  const errorMessage = error?.message || '';
  const serverErrorPatterns = [
    'Server error',
    'Internal server error',
    'Bad Gateway',
    'Service Unavailable',
    'Rate limit',
    'Circuit breaker',
    'Authentication failed'
  ];

  if (serverErrorPatterns.some(pattern => errorMessage.includes(pattern))) {
    console.log(`[QueryProvider] NOT retrying: ${errorMessage.substring(0, 50)}`);
    return false;
  }

  // Only retry on network/timeout errors
  if (errorMessage.includes('network') || errorMessage.includes('timeout') || error?.name === 'TypeError') {
    return true;
  }

  // Don't retry unknown errors
  return false;
};

// Create a client with 5-minute cache TTL (matching legacy environmentsCache.js)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - matches legacy cache TTL
      gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      retry: shouldRetryQuery, // Use custom retry logic
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 30000), // Exponential backoff starting at 2s
    },
    mutations: {
      retry: false, // Don't retry mutations - let apiService handle it
    },
  },
});

export const QueryProvider = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export default QueryProvider;
