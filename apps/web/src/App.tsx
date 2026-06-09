import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTRPCClient, setOnRefreshSuccess } from './trpc';
import { router } from './router';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Re-pull on reconnection — covers offline→online transitions where the
        // token interceptor alone can't nudge React Query.
        refetchOnReconnect: 'always',
        retry: (failureCount, error) => {
          const status = (error as { data?: { httpStatus?: number } }).data?.httpStatus;
          // Genuine client errors (validation, not found, forbidden) won't get
          // better by retrying. Everything else — network blips, 5xx, and the
          // 401s the refresh interceptor is still racing to recover — gets a few
          // attempts (~15s with the default backoff) so a slow mobile cold-start
          // doesn't strand the dashboard at zero.
          if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
            return false;
          }
          return failureCount < 4;
        },
      },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  // When a background token refresh succeeds (startup, proactive timer, or
  // returning to the app), re-pull whatever is currently on screen. This is the
  // recovery path that turns "logged in but everything is zero" back into live
  // data without forcing the user to log out and back in.
  useEffect(() => {
    setOnRefreshSuccess(() => {
      void queryClient.refetchQueries({ type: 'active' });
    });
  }, [queryClient]);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
