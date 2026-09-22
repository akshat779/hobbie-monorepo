import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { FloatingGlassTabBar } from '../../src/components/navigation/FloatingGlassTabBar';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { queryKeys } from '../../src/services/queryKeys';
import { fetchMySquads } from '../../src/features/activity/useMyActivitiesQuery';

export default function MainTabLayout() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  // Proactive background prefetching (pf-route-prefetch)
  // Warms the "My Squads" cache on layout mount so switching tabs is instantaneous (0ms)
  useEffect(() => {
    if (userId) {
      void queryClient.prefetchQuery({
        queryKey: queryKeys.activities.mySquads(userId),
        queryFn: () => fetchMySquads(userId),
        staleTime: 1000 * 60,
      });
    }
  }, [userId, queryClient]);

  return (
    <Tabs
      tabBar={(props) => <FloatingGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hobbie',
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Feed',
        }}
      />
      <Tabs.Screen
        name="my-activities"
        options={{
          title: 'My Squads',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

