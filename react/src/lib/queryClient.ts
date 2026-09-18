import { QueryClient } from '@tanstack/react-query';

/** Single app-wide cache — cleared whenever the auth session ends or switches. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid serving another user's cached data after a fast account switch.
      staleTime: 30_000,
    },
  },
});
