import { useQuery } from '@tanstack/react-query';
import { fetchActivityDetails, ActivityDetails } from '../../services/activityDetail';
import { getJoinRequestStatus, JoinRequestRow } from '../../services/handshake';
import { queryKeys } from '../../services/queryKeys';

export function useActivityDetailQuery(activityId: string | undefined) {
  return useQuery<ActivityDetails | null>({
    queryKey: queryKeys.activities.detail(activityId || ''),
    queryFn: () => fetchActivityDetails(activityId || ''),
    enabled: Boolean(activityId),
    staleTime: 1000 * 30,
  });
}

export function useJoinStatusQuery(
  activityId: string | undefined,
  userId: string | undefined
) {
  return useQuery<JoinRequestRow | null>({
    queryKey: queryKeys.activities.joinStatus(activityId || '', userId || ''),
    queryFn: () => getJoinRequestStatus(activityId || '', userId || ''),
    enabled: Boolean(activityId && userId),
    staleTime: 1000 * 10,
  });
}
