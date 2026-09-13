import { useState, useCallback } from 'react';

/**
 * Canonical React Native + TanStack Query hook (TkDodo pattern).
 * Distinguishes user-initiated pull-to-refresh from automatic background refetches.
 * Prevents the native RefreshControl spinner from unexpectedly appearing during
 * silent background cache updates or screen/tab transitions.
 *
 * @see https://tkdodo.eu/blog/react-query-and-react-native#pull-to-refresh
 */
export function useRefreshByUser(refetch: () => Promise<unknown>) {
  const [isRefetchingByUser, setIsRefetchingByUser] = useState(false);

  const refetchByUser = useCallback(async () => {
    setIsRefetchingByUser(true);
    try {
      await refetch();
    } finally {
      setIsRefetchingByUser(false);
    }
  }, [refetch]);

  return {
    isRefetchingByUser,
    refetchByUser,
  };
}
