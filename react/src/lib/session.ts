import { clearAuthState } from '@/api/client';
import { queryClient } from '@/lib/queryClient';

/** Drop tokens and all React Query cache (leave lists, team, users, etc.). */
export function endClientSession(): void {
  clearAuthState();
}

/** Wipe cached API data before attaching a new authenticated user. */
export function resetQueryCacheForNewSession(): void {
  queryClient.clear();
}
