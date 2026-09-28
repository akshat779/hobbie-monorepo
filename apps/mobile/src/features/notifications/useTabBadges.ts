import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { JoinRequestRealtimeRowSchema } from '@hobbie/shared';
import { useAuthStore } from '../auth/useAuthStore';
import { useMyActivitiesQuery } from '../activity/useMyActivitiesQuery';
import { queryKeys } from '../../services/queryKeys';
import {
  subscribeToPostgresChanges,
  type PostgresChangeConfig,
} from '../../services/realtimePool';
import { useNotificationsStore } from './useNotificationsStore';
import { computeTabBadges, type TabBadges } from './tabBadges';

/**
 * Computes the floating tab-bar notification dots.
 *
 * - My Squads lights up for a host while any hosted squad has pending requests
 *   (server-derived, so it clears as soon as requests are handled) and for a
 *   joiner once an accept lands until they open My Squads.
 * - Realtime is used so both transitions land immediately instead of waiting for
 *   the 30s My Squads background sync.
 */
export function useTabBadges(): TabBadges {
  const userId = useAuthStore((s) => s.session?.user?.id);
  const queryClient = useQueryClient();
  const { data: squads = [] } = useMyActivitiesQuery(userId);

  const ownerId = useNotificationsStore((s) => s.ownerId);
  const unseenAcceptedActivityIds = useNotificationsStore(
    (s) => s.unseenAcceptedActivityIds
  );
  const setOwner = useNotificationsStore((s) => s.setOwner);
  const markActivityAccepted = useNotificationsStore((s) => s.markActivityAccepted);

  // Drop another identity's unseen state the moment the session changes.
  useEffect(() => {
    setOwner(userId ?? null);
  }, [userId, setOwner]);

  const hostedIdsKey = useMemo(
    () =>
      squads
        .filter((squad) => squad.isHost)
        .map((squad) => squad.id)
        .join(','),
    [squads]
  );

  // Host signal: any join-request change on a hosted squad refreshes the count.
  useEffect(() => {
    if (!userId || !hostedIdsKey) return;

    const configs: PostgresChangeConfig[] = hostedIdsKey
      .split(',')
      .flatMap((activityId) =>
        (['INSERT', 'UPDATE'] as const).map((event) => ({
          event,
          schema: 'public' as const,
          table: 'join_requests',
          filter: `activity_id=eq.${activityId}`,
        }))
      );

    return subscribeToPostgresChanges(
      `host_request_badges_${userId}`,
      configs,
      () => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.activities.mySquads(userId),
        });
      },
      (message) => console.warn('Host badge Realtime error:', message)
    );
  }, [userId, hostedIdsKey, queryClient]);

  // Joiner signal: an accepted request lights My Squads until it is seen.
  useEffect(() => {
    if (!userId) return;

    return subscribeToPostgresChanges(
      `my_request_badges_${userId}`,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'join_requests',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const parsed = JoinRequestRealtimeRowSchema.safeParse(
          (payload as { new?: unknown } | null)?.new
        );
        if (parsed.success && parsed.data.status === 'accepted') {
          markActivityAccepted(parsed.data.activity_id);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.activities.mySquads(userId),
          });
        }
      },
      (message) => console.warn('Joiner badge Realtime error:', message)
    );
  }, [userId, markActivityAccepted, queryClient]);

  const pendingHostRequests = useMemo(
    () =>
      squads.reduce(
        (total, squad) => total + (squad.pendingRequestsCount ?? 0),
        0
      ),
    [squads]
  );

  const unseenAcceptances =
    ownerId === userId ? unseenAcceptedActivityIds.length : 0;

  return computeTabBadges({ pendingHostRequests, unseenAcceptances });
}
