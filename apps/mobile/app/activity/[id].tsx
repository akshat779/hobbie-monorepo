import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Clock,
  MapPin,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Settings,
  ArrowRight,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { subscribeToJoinRequestUpdates } from '../../src/services/handshake';
import {
  useActivityDetailQuery,
  useJoinStatusQuery,
} from '../../src/features/activity/useActivityDetailQuery';
import { useJoinRequestMutation } from '../../src/features/activity/useActivityMutations';
import { HostReviewModal } from '../../src/features/handshake/HostReviewModal';

import { useCountdown } from '../../src/hooks/useCountdown';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id || '');

  const {
    data: activity,
    isLoading,
    refetch: refetchActivity,
  } = useActivityDetailQuery(id);
  const { data: existingRequest, refetch: refetchJoinStatus } =
    useJoinStatusQuery(id, currentUserId);
  const joinMutation = useJoinRequestMutation();

  const { isExpired, formattedTtl, theme } = useCountdown(activity?.expiresAt);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostModalVisible, setHostModalVisible] = useState(false);

  const isSubmitting = joinMutation.isPending;

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

  const loadActivityData = useCallback(() => {
    refetchActivity();
    refetchJoinStatus();
  }, [refetchActivity, refetchJoinStatus]);

  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime subscription for pending request status changes
  useEffect(() => {
    if (!existingRequest || existingRequest.status !== 'pending') return;

    const unsubscribe = subscribeToJoinRequestUpdates(existingRequest.id, (newStatus) => {
      if (newStatus === 'accepted') {
        // Automatically transition into the ephemeral room upon acceptance!
        navigationTimerRef.current = setTimeout(() => {
          router.replace(`/room/${id}`);
        }, 600);
      } else {
        loadActivityData();
      }
    });

    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
      unsubscribe();
    };
  }, [existingRequest?.id, existingRequest?.status, id, router, loadActivityData]);

  const handleJoin = async () => {
    if (!currentUserId) {
      setErrorMessage('Please select a dev persona or log in to request to join.');
      return;
    }

    setErrorMessage(null);
    try {
      await joinMutation.mutateAsync({
        activityId: id,
        userId: currentUserId,
        message,
      });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit join request'
      );
    }
  };

  const isHost = activity ? activity.hostId === currentUserId : false;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      <View
        style={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        className="flex-1 px-5 justify-between"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          className="flex-1"
        >
        {/* Top Header Navigation */}
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Feed"
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full bg-ink border border-hairline items-center justify-center"
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
              accessibilityRole="button"
              accessibilityLabel="Host squad settings"
              onPress={() => setHostModalVisible(true)}
              className="w-11 h-11 rounded-full bg-signal-violet/20 border border-signal-violet items-center justify-center"
              activeOpacity={0.7}
            >
              <Settings size={18} color="#C77DFF" />
            </TouchableOpacity>
          ) : (
            <View className="w-11" />
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

            {/* Live Status & Capacity Header */}
            <View className="flex-row items-center mb-4 flex-wrap gap-2">
              <View
                style={{
                  borderColor: isExpired ? '#2C2739' : theme.badgeBorder,
                  backgroundColor: isExpired ? '#17131F' : theme.bg,
                }}
                className="flex-row items-center px-3 py-1 rounded-full border"
              >
                <Clock size={12} color={isExpired ? '#5A536B' : theme.primary} />
                <Text
                  style={{ color: isExpired ? '#A99BC2' : theme.badgeText }}
                  className="font-mono text-xs font-bold ml-1.5"
                >
                  {isExpired ? 'Squad Expired' : `${formattedTtl} left`}
                </Text>
              </View>

              <View className="flex-row items-center px-3 py-1 rounded-full bg-ink border border-hairline">
                <Users size={12} color="#C77DFF" />
                <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1.5">
                  {activity.currentParticipantsCount} / {activity.maxParticipants} spots filled
                </Text>
              </View>
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
                  {activity.hostIsVerified && <VerifiedBadge size={14} />}
                  <View className="bg-void border border-hairline px-2 py-0.5 rounded-full">
                    <Text className="text-pulse-lilac font-mono text-xs font-bold">
                      ★ {activity.hostTrustScore !== null ? activity.hostTrustScore.toFixed(2) : '5.00'}
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
                    testID="review-requests"
                    accessibilityRole="button"
                    accessibilityLabel="Review Requests"
                    onPress={() => setHostModalVisible(true)}
                    className="flex-1 h-12 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30 active:scale-95"
                    activeOpacity={0.85}
                  >
                    <Users size={15} color="#F5F0FF" style={{ marginRight: 6 }} />
                    <Text className="text-moonlight font-display text-xs font-bold">
                      Review Requests
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="enter-room"
                    accessibilityRole="button"
                    accessibilityLabel="Enter Room"
                    onPress={() => router.replace(`/room/${activity.id}`)}
                    className="flex-1 h-12 bg-ink border border-hairline rounded-full flex-row items-center justify-center active:bg-ink-raised"
                    activeOpacity={0.85}
                  >
                    <Text className="text-moonlight font-display text-xs font-bold mr-1">
                      Enter Room
                    </Text>
                    <ArrowRight size={15} color="#F5F0FF" />
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
                  accessibilityRole="button"
                  accessibilityLabel="Enter Squad Chat and Venue"
                  onPress={() => router.replace(`/room/${activity.id}`)}
                  className="w-full h-12 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
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
                  className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight text-base focus:border-signal-violet"
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
          testID="request-to-join"
          accessibilityRole="button"
          accessibilityLabel="Request to Join Squad"
          onPress={handleJoin}
          disabled={isSubmitting || isExpired || activity.currentParticipantsCount >= activity.maxParticipants}
          className={`w-full h-14 rounded-full flex-row items-center justify-center border ${
            isExpired || activity.currentParticipantsCount >= activity.maxParticipants
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
                {isExpired
                  ? 'Squad Expired'
                  : activity.currentParticipantsCount >= activity.maxParticipants
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
    </KeyboardAvoidingView>
  );
}
