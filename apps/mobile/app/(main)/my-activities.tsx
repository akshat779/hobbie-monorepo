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
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { HostReviewModal } from '../../src/features/handshake/HostReviewModal';
import { getPendingRequestsCount } from '../../src/services/handshake';

interface MySquadItem {
  id: string;
  title: string;
  interestId: string;
  hostId: string;
  venueName: string | null;
  expiresAt: string;
  currentParticipantsCount: number;
  maxParticipants: number;
  status: string;
  isHost: boolean;
  pendingRequestsCount?: number;
}

export default function MyActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const currentUserId = user?.id || profile?.id || '';

  const [squads, setSquads] = useState<MySquadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected squad for host review modal
  const [activeHostReview, setActiveHostReview] = useState<MySquadItem | null>(null);

  const fetchMySquads = useCallback(async () => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch activities hosted by user
      const { data: hosted } = await supabase
        .from('activities')
        .select('*')
        .eq('host_id', currentUserId)
        .order('created_at', { ascending: false });

      // 2. Fetch activities where user is an accepted member
      const { data: memberships } = await supabase
        .from('activity_members')
        .select('activity_id, is_host')
        .eq('user_id', currentUserId)
        .eq('is_host', false);

      const memberActivityIds = memberships?.map((m) => m.activity_id) || [];
      let memberActivities: any[] = [];
      if (memberActivityIds.length > 0) {
        const { data: acts } = await supabase
          .from('activities')
          .select('*')
          .in('id', memberActivityIds);
        memberActivities = acts || [];
      }

      // 3. For hosted activities, count pending requests
      const squadList: MySquadItem[] = [];

      if (hosted) {
        for (const act of hosted) {
          const pendingCount = await getPendingRequestsCount(act.id);

          squadList.push({
            id: act.id,
            title: act.title,
            interestId: act.interest_id,
            hostId: act.host_id,
            venueName: act.venue_name,
            expiresAt: act.expires_at,
            currentParticipantsCount: act.current_participants_count,
            maxParticipants: act.max_participants,
            status: act.status,
            isHost: true,
            pendingRequestsCount: pendingCount,
          });
        }
      }

      for (const act of memberActivities) {
        squadList.push({
          id: act.id,
          title: act.title,
          interestId: act.interest_id,
          hostId: act.host_id,
          venueName: act.venue_name,
          expiresAt: act.expires_at,
          currentParticipantsCount: act.current_participants_count,
          maxParticipants: act.max_participants,
          status: act.status,
          isHost: false,
        });
      }

      setSquads(squadList);
    } catch (err) {
      console.warn('fetchMySquads error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchMySquads();
  }, [fetchMySquads]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchMySquads();
  };

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5 pb-8"
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
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
                onPress={() => router.push('/activity/create')}
                className="bg-signal-violet px-6 py-3.5 rounded-full flex-row items-center border border-signal-violet-light/30"
                activeOpacity={0.85}
              >
                <Text className="text-moonlight font-display text-xs font-bold">
                  Host a Squad
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            squads.map((squad) => (
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
                  <Text className="text-dusk font-mono text-[11px]">
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
                    className={`text-[10px] font-bold ${
                      squad.isHost ? 'text-signal-violet-light' : 'text-dusk'
                    }`}
                  >
                    {squad.isHost ? 'Host' : 'Member'}
                  </Text>
                </View>
              </View>

              {/* TTL Banner */}
              <View className="flex-row items-center mb-4">
                <Clock size={12} color="#FF6B5E" />
                <Text className="text-ember font-mono text-xs font-bold ml-1.5">
                  Self-Destructs with Squad TTL
                </Text>
              </View>

              {/* Actions */}
              <View className="flex-row gap-2.5">
                {squad.isHost && (
                  <TouchableOpacity
                    onPress={() => setActiveHostReview(squad)}
                    className="flex-1 h-12 bg-ink border border-signal-violet/50 rounded-full flex-row items-center justify-center relative active:bg-ink-raised"
                    activeOpacity={0.8}
                  >
                    <Users size={14} color="#C77DFF" style={{ marginRight: 6 }} />
                    <Text className="text-pulse-lilac font-display text-xs font-bold">
                      Requests {squad.pendingRequestsCount ? `(${squad.pendingRequestsCount})` : ''}
                    </Text>
                    {!!squad.pendingRequestsCount && (
                      <View className="absolute -top-1.5 -right-1.5 bg-signal-violet rounded-full px-2 py-0.5 border border-void">
                        <Text className="text-moonlight font-mono text-[9px] font-bold">
                          {squad.pendingRequestsCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => router.push(`/room/${squad.id}`)}
                  className="flex-1 h-12 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30 active:scale-95"
                  activeOpacity={0.8}
                >
                  <Text className="text-moonlight font-display text-xs font-bold mr-1.5">
                    Enter Chat Room
                  </Text>
                  <ArrowRight size={14} color="#F5F0FF" />
                </TouchableOpacity>
              </View>
            </View>
          )))}
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
            fetchMySquads();
          }}
          onSquadUpdated={() => {
            fetchMySquads();
          }}
        />
      )}
    </View>
  );
}
