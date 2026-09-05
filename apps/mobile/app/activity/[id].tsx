import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ShieldCheck,
  Clock,
  MapPin,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Settings,
  ArrowRight,
} from 'lucide-react-native';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import {
  requestToJoin,
  getJoinRequestStatus,
  subscribeToJoinRequestUpdates,
  JoinRequestRow,
} from '../../src/services/handshake';
import { HostReviewModal } from '../../src/features/handshake/HostReviewModal';

interface ActivityDetails {
  id: string;
  hostId: string;
  hostName: string;
  hostTrustScore: number;
  hostIsVerified: boolean;
  title: string;
  description: string;
  venueName: string | null;
  expiresAt: string;
  maxParticipants: number;
  currentParticipantsCount: number;
  status: string;
}

export default function ActivityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuthStore();
  const currentUserId = user?.id || profile?.id || '';

  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<JoinRequestRow | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostModalVisible, setHostModalVisible] = useState(false);

  // Pulse animation for pending state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (existingRequest?.status === 'pending') {
      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.5,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
    }
    return () => {
      animation?.stop();
    };
  }, [existingRequest?.status, pulseAnim, pulseOpacity]);

  // Load activity details and check join request status
  const loadActivityData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    try {
      // 1. Fetch activity row
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (actData) {
        // Fetch host profile
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('name, trust_score, is_verified')
          .eq('id', actData.host_id)
          .maybeSingle();

        setActivity({
          id: actData.id,
          hostId: actData.host_id,
          hostName: hostProfile?.name || 'Hobbie Host',
          hostTrustScore: hostProfile?.trust_score ?? 5.0,
          hostIsVerified: hostProfile?.is_verified ?? false,
          title: actData.title,
          description: actData.description || '',
          venueName: actData.venue_name,
          expiresAt: actData.expires_at,
          maxParticipants: actData.max_participants,
          currentParticipantsCount: actData.current_participants_count,
          status: actData.status,
        });
      } else {
        setActivity(null);
      }

      // 2. Check if current user has an existing request
      if (currentUserId) {
        const req = await getJoinRequestStatus(id, currentUserId);
        setExistingRequest(req);
      }
    } catch (err) {
      console.warn('Load activity data error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    loadActivityData();
  }, [loadActivityData]);

  // Realtime subscription for pending request status changes
  useEffect(() => {
    if (!existingRequest || existingRequest.status !== 'pending') return;

    const channel = subscribeToJoinRequestUpdates(existingRequest.id, (newStatus) => {
      setExistingRequest((prev) => (prev ? { ...prev, status: newStatus } : null));

      if (newStatus === 'accepted') {
        // Automatically transition into the ephemeral room upon acceptance!
        setTimeout(() => {
          router.replace(`/room/${id}`);
        }, 600);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [existingRequest?.id, existingRequest?.status, id, router]);

  const handleJoin = async () => {
    if (!currentUserId) {
      setErrorMessage('Please select a dev persona or log in to request to join.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await requestToJoin(id, currentUserId, message);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    if (result.data) {
      setExistingRequest(result.data);
    }
  };

  const isHost = activity ? activity.hostId === currentUserId : false;

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5 justify-between pb-8"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Top Header Navigation */}
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="items-center flex-1 mx-2">
            <Text className="text-base font-bold font-display text-moonlight">
              Squad Details
            </Text>
          </View>

          {isHost ? (
            <TouchableOpacity
              onPress={() => setHostModalVisible(true)}
              className="w-10 h-10 rounded-full bg-signal-violet/20 border border-signal-violet items-center justify-center"
              activeOpacity={0.7}
            >
              <Settings size={18} color="#C77DFF" />
            </TouchableOpacity>
          ) : (
            <View className="w-10" />
          )}
        </View>

        {isLoading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#7B2FF7" />
          </View>
        ) : activity ? (
          <>
            {/* Squad Title */}
            <Text className="text-moonlight font-display text-2xl font-extrabold tracking-tight mb-1">
              {activity.title}
            </Text>

            {/* TTL Remaining Header */}
            <View className="flex-row items-center mb-4">
              <Clock size={13} color="#C77DFF" />
              <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1.5">
                Active Broadcast • {activity.currentParticipantsCount} /{' '}
                {activity.maxParticipants} spots filled
              </Text>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View className="bg-ember/15 border border-ember/60 p-3 rounded-2xl mb-4">
                <Text className="text-ember font-body text-xs font-semibold">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Host Identity Card */}
            <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-moonlight font-bold font-display text-base">
                  Host: {activity.hostName}
                </Text>
                <View className="flex-row items-center gap-2">
                  {activity.hostIsVerified && (
                    <View className="bg-signal-violet/20 border border-signal-violet px-2.5 py-0.5 rounded-full flex-row items-center">
                      <ShieldCheck size={12} color="#D2BBFF" />
                      <Text className="text-signal-violet-light text-[11px] font-bold ml-1">
                        Verified
                      </Text>
                    </View>
                  )}
                  <View className="bg-void border border-hairline px-2 py-0.5 rounded-full">
                    <Text className="text-pulse-lilac font-mono text-xs font-bold">
                      ★ {activity.hostTrustScore.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text className="text-dusk font-body text-xs leading-relaxed">
                {activity.description || 'No additional description provided.'}
              </Text>
            </View>

            {/* Venue & Geofenced Location Card */}
            <View className="bg-ink border border-hairline p-5 rounded-3xl mb-5">
              <View className="flex-row items-center mb-1">
                <MapPin size={14} color="#C77DFF" />
                <Text className="text-moonlight font-bold font-display text-sm ml-1.5">
                  Geofenced Venue
                </Text>
              </View>
              <Text className="text-dusk font-body text-xs leading-relaxed">
                {activity.venueName
                  ? `Near ${activity.venueName}`
                  : 'Approximate ~100m zone (Exact location unlocks upon host acceptance)'}
              </Text>
            </View>

            {/* Host Perspective View */}
            {isHost && (
              <View className="bg-ink-raised border border-signal-violet/60 p-5 rounded-3xl mb-5">
                <Text className="text-moonlight font-display font-bold text-base mb-1">
                  You are Hosting this Squad
                </Text>
                <Text className="text-dusk font-body text-xs mb-4 leading-relaxed">
                  Review join requests, manage squad size, and enter the active chat room.
                </Text>

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setHostModalVisible(true)}
                    className="flex-1 py-3 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30 active:scale-95"
                    activeOpacity={0.85}
                  >
                    <Users size={14} color="#F5F0FF" style={{ marginRight: 6 }} />
                    <Text className="text-moonlight font-display text-xs font-bold">
                      Review Requests
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.replace(`/room/${activity.id}`)}
                    className="flex-1 py-3 bg-ink border border-hairline rounded-full flex-row items-center justify-center active:bg-ink-raised"
                    activeOpacity={0.85}
                  >
                    <Text className="text-moonlight font-display text-xs font-bold mr-1">
                      Enter Room
                    </Text>
                    <ArrowRight size={14} color="#F5F0FF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Joiner Perspective View: Request States */}
            {!isHost && existingRequest?.status === 'accepted' && (
              <View className="bg-ink-raised border border-signal-violet p-5 rounded-3xl items-center mb-5">
                <View className="w-10 h-10 rounded-full bg-signal-violet/20 border border-signal-violet items-center justify-center mb-2">
                  <CheckCircle2 size={20} color="#C77DFF" />
                </View>
                <Text className="text-moonlight font-display font-bold text-base mb-1">
                  You are Accepted!
                </Text>
                <Text className="text-dusk text-xs text-center mb-4">
                  The host approved your join request. The ephemeral chat room and exact venue pin are unlocked.
                </Text>
                <TouchableOpacity
                  onPress={() => router.replace(`/room/${activity.id}`)}
                  className="w-full py-3.5 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
                  activeOpacity={0.85}
                >
                  <Text className="text-moonlight font-display text-sm font-bold mr-2">
                    Enter Squad Chat & Venue
                  </Text>
                  <ArrowRight size={16} color="#F5F0FF" />
                </TouchableOpacity>
              </View>
            )}

            {!isHost && existingRequest?.status === 'pending' && (
              <Animated.View
                style={{
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity,
                }}
                className="bg-ink-raised border border-signal-violet p-5 rounded-3xl items-center mb-5 shadow-lg"
              >
                <Clock size={24} color="#C77DFF" className="mb-2" />
                <Text className="text-pulse-lilac font-display font-bold text-base mb-1">
                  Join Request Pending...
                </Text>
                <Text className="text-dusk text-xs text-center leading-relaxed">
                  Waiting for {activity.hostName} to review. You will automatically enter the room once approved!
                </Text>
              </Animated.View>
            )}

            {!isHost && existingRequest?.status === 'declined' && (
              <View className="bg-ink border border-ember/60 p-5 rounded-3xl items-center mb-5">
                <XCircle size={24} color="#FF6B5E" className="mb-2" />
                <Text className="text-ember font-display font-bold text-base mb-1">
                  Request Declined
                </Text>
                <Text className="text-dusk text-xs text-center leading-relaxed">
                  The squad may have reached capacity or completed its group. Check out other nearby squads on the map!
                </Text>
              </View>
            )}

            {/* Note Input for new joiners */}
            {!isHost && !existingRequest && (
              <View className="mb-4">
                <Text className="text-dusk text-xs uppercase font-semibold tracking-wider mb-2 ml-1">
                  Note to Host (Optional)
                </Text>
                <TextInput
                  placeholder="e.g. I can play defense or striker! Free now."
                  placeholderTextColor="#5A536B"
                  value={message}
                  onChangeText={setMessage}
                  maxLength={150}
                  className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight text-sm focus:border-signal-violet"
                />
              </View>
            )}
          </>
        ) : (
          <View className="py-20 items-center justify-center">
            <Text className="text-dusk font-body text-sm">Squad not found or expired.</Text>
          </View>
        )}
      </ScrollView>

      {/* Primary CTA Button for Joiner without request */}
      {!isHost && !existingRequest && activity && (
        <TouchableOpacity
          onPress={handleJoin}
          disabled={isSubmitting || activity.currentParticipantsCount >= activity.maxParticipants}
          className={`w-full h-14 rounded-full flex-row items-center justify-center border ${
            activity.currentParticipantsCount >= activity.maxParticipants
              ? 'bg-ink border-hairline opacity-50'
              : 'bg-signal-violet border-signal-violet-light/30 active:scale-95'
          }`}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#F5F0FF" />
          ) : (
            <>
              <Send size={16} color="#F5F0FF" style={{ marginRight: 8 }} />
              <Text className="text-moonlight font-display text-base font-bold">
                {activity.currentParticipantsCount >= activity.maxParticipants
                  ? 'Squad Capacity Full'
                  : `Request to Join Squad (${activity.currentParticipantsCount}/${activity.maxParticipants})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Host Review Modal */}
      {activity && isHost && (
        <HostReviewModal
          visible={hostModalVisible}
          activityId={activity.id}
          activityTitle={activity.title}
          currentParticipantsCount={activity.currentParticipantsCount}
          maxParticipants={activity.maxParticipants}
          onClose={() => {
            setHostModalVisible(false);
            loadActivityData();
          }}
          onSquadUpdated={() => {
            loadActivityData();
          }}
        />
      )}
    </View>
  );
}
