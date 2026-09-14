import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Clock,
  ArrowRight,
  ShieldCheck,
  Inbox,
  UserCheck,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { HostReviewModal } from '../../src/features/handshake/HostReviewModal';
import { useMyActivitiesQuery, MySquadItem } from '../../src/features/activity/useMyActivitiesQuery';
import { useRefreshByUser } from '../../src/hooks/useRefreshByUser';
import { useCountdown } from '../../src/hooks/useCountdown';

function MySquadCard({
  squad,
  onReview,
  onEnterRoom,
}: {
  squad: MySquadItem;
  onReview?: (squad: MySquadItem) => void;
  onEnterRoom: (squadId: string) => void;
}) {
  const { isExpired, formattedTtl, theme } = useCountdown(squad.expiresAt);

  return (
    <View
      key={squad.id}
      className="bg-ink border border-hairline p-5 rounded-3xl mb-4"
    >
      {/* Header */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-moonlight font-bold font-display text-base mb-0.5">
            {squad.title}
          </Text>
          <Text className="text-dusk font-mono text-2xs">
            {squad.venueName || 'Geofenced Location'} • {squad.currentParticipantsCount}/
            {squad.maxParticipants} players
          </Text>
        </View>

        <View
          className={`px-2.5 py-0.5 rounded-full border ${
            squad.isHost
              ? 'bg-signal-violet/20 border-signal-violet'
              : 'bg-ink-raised border-hairline'
          }`}
        >
          <Text
            className={`text-2xs font-bold ${
              squad.isHost ? 'text-signal-violet-light' : 'text-dusk'
            }`}
          >
            {squad.isHost ? 'Host' : 'Member'}
          </Text>
        </View>
      </View>

      {/* Live Status / Countdown Banner */}
      <View className="flex-row items-center mb-4">
        <Clock size={12} color={isExpired ? '#C77DFF' : theme.primary} />
        <Text
          style={{ color: isExpired ? '#C77DFF' : theme.badgeText }}
          className="font-mono text-xs font-bold ml-1.5"
        >
          {isExpired ? 'Squad Formed • Chat Active' : `Joining closes in ${formattedTtl}`}
        </Text>
      </View>

      {/* Actions */}
      <View className="flex-row gap-2.5">
        {squad.isHost && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Review ${squad.pendingRequestsCount || 0} requests for ${squad.title}`}
            onPress={() => onReview?.(squad)}
            className="flex-1 h-12 bg-ink border border-signal-violet/50 rounded-full flex-row items-center justify-center relative active:bg-ink-raised"
            activeOpacity={0.8}
          >
            <Users size={15} color="#C77DFF" style={{ marginRight: 6 }} />
            <Text className="text-pulse-lilac font-display text-xs font-bold">
              Requests {squad.pendingRequestsCount ? `(${squad.pendingRequestsCount})` : ''}
            </Text>
            {!!squad.pendingRequestsCount && (
              <View className="absolute -top-1.5 -right-1.5 bg-signal-violet rounded-full px-2 py-0.5 border border-void">
                <Text className="text-moonlight font-mono text-2xs font-bold">
                  {squad.pendingRequestsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Enter chat room for ${squad.title}`}
          onPress={() => onEnterRoom(squad.id)}
          className="flex-1 h-12 rounded-full flex-row items-center justify-center border bg-signal-violet border-signal-violet-light/30 active:scale-95"
          activeOpacity={0.8}
        >
          <Text className="text-moonlight font-display text-xs font-bold mr-1.5">
            Enter Chat Room
          </Text>
          <ArrowRight size={14} color="#F5F0FF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const {
    data: squads = [],
    isLoading,
    refetch,
  } = useMyActivitiesQuery(currentUserId);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  // Selected squad for host review modal
  const [activeHostReview, setActiveHostReview] = useState<MySquadItem | null>(null);

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5"
    >
      <View className="mb-5">
        <View className="flex-row items-center mb-1">
          <Users size={20} color="#C77DFF" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac ml-1.5">
            Squad Coordination
          </Text>
        </View>
        <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
          My Squads
        </Text>
        <Text className="text-xs text-dusk">
          Your active rooms, hosted squads, and pending reviews.
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7B2FF7" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingByUser}
              onRefresh={refetchByUser}
              tintColor="#7B2FF7"
            />
          }
          className="flex-1"
        >
          {squads.length === 0 ? (
            <View className="py-20 items-center justify-center px-4">
              <View className="w-16 h-16 rounded-full bg-ink-raised border border-hairline items-center justify-center mb-4">
                <Users size={28} color="#C77DFF" />
              </View>
              <Text className="text-moonlight font-display text-lg font-bold text-center mb-1.5">
                No Active Squads
              </Text>
              <Text className="text-dusk font-body text-xs text-center px-4 leading-relaxed mb-6">
                You haven't hosted or joined any squads yet. Discover live squads on the radar or host your own!
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Host a Squad"
                onPress={() => router.push('/activity/create')}
                className="bg-signal-violet px-6 py-3.5 rounded-full flex-row items-center border border-signal-violet-light/30"
                activeOpacity={0.85}
              >
                <Text className="text-moonlight font-display text-sm font-bold">
                  Host a Squad
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            squads.map((squad) => (
              <MySquadCard
                key={squad.id}
                squad={squad}
                onReview={setActiveHostReview}
                onEnterRoom={(squadId) => router.push(`/room/${squadId}`)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Host Review Modal */}
      {activeHostReview && (
        <HostReviewModal
          visible={!!activeHostReview}
          activityId={activeHostReview.id}
          activityTitle={activeHostReview.title}
          currentParticipantsCount={activeHostReview.currentParticipantsCount}
          maxParticipants={activeHostReview.maxParticipants}
          onClose={() => {
            setActiveHostReview(null);
            refetch();
          }}
          onSquadUpdated={() => {
            refetch();
          }}
        />
      )}
    </View>
  );
}
