import { useQuery } from '@tanstack/react-query';
import { ActivityPublic } from '@hobbie/shared';
import { fetchActivityDetails } from '../../services/activityDetail';
import { getJoinRequestStatus } from '../../services/handshake';
import { RequestToJoinResult } from '@hobbie/shared';
import { queryKeys } from '../../services/queryKeys';

export function useActivityDetailQuery(activityId: string | undefined) {
  return useQuery<ActivityPublic | null>({
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
  return useQuery<RequestToJoinResult | null>({
    queryKey: queryKeys.activities.joinStatus(activityId || '', userId || ''),
    queryFn: () => getJoinRequestStatus(activityId || '', userId || ''),
    enabled: Boolean(activityId && userId),
    staleTime: 1000 * 10,
  });
}
