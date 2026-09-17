import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Send,
  MapPin,
  Clock,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import {
  useRoomMetadataQuery,
  useRoomMessagesQuery,
  useSendRoomMessageMutation,
  useActivityExactLocationQuery,
  useConcludeActivityMutation,
  setupRealtimeRoomSync,
} from '../../src/features/room/useRoomQuery';
import { VenueLocationModal } from '../../src/features/room/VenueLocationModal';
import { leaveSquad } from '../../src/services/handshake';
import { queryKeys } from '../../src/services/queryKeys';
import { MySquadItem } from '../../src/features/activity/useMyActivitiesQuery';

import { useCountdown } from '../../src/hooks/useCountdown';

export default function ActiveEphemeralRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [input, setInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showVenueModal, setShowVenueModal] = useState(false);

  const { data: roomMeta } = useRoomMetadataQuery(id);
  const { data: messages = [], error: messagesQueryError } = useRoomMessagesQuery(id);
  const { data: exactLocation, isLoading: isLocationLoading } = useActivityExactLocationQuery(id);
  const sendMutation = useSendRoomMessageMutation(id || '');
  const concludeMutation = useConcludeActivityMutation(id || '');

  const title = roomMeta?.title || 'Squad Chat';
  const venueName = roomMeta?.venueName;
  const expiresAt = roomMeta?.expiresAt || null;
  const isHost = currentUserId === roomMeta?.hostId;
  const isConcluded = roomMeta?.status === 'concluded';

  const { isExpired, formattedTtl, urgency, theme } = useCountdown(expiresAt, 5000);

  // Burning ember pulse animation when expiring (Native Driver Safe)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (urgency === 'expiring' && !isExpired && !isConcluded) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [urgency, isExpired, isConcluded, pulseAnim]);

  // Realtime subscription directly syncing with TanStack Query cache
  useEffect(() => {
    if (!id) return;
    const unsubscribe = setupRealtimeRoomSync(
      id,
      currentUserId,
      queryClient,
      (message) => {
        setRoomError(`Live updates unavailable: ${message}. Messages can still be refreshed.`);
      }
    );
    return () => {
      unsubscribe();
    };
  }, [id, currentUserId, queryClient]);

  const handleSend = useCallback(async () => {
    if (!id || !input.trim()) return;
    const messageContent = input.trim();
    setInput('');
    setRoomError(null);

    try {
      await sendMutation.mutateAsync({ content: messageContent });
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [id, input, sendMutation]);

  const handleHostConclude = useCallback(() => {
    if (!id || !currentUserId) return;
    Alert.alert(
      'Conclude Activity',
      'Are you sure you want to conclude this meetup? This will end the meetup for all participants and open feedback.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Conclude',
          style: 'default',
          onPress: async () => {
            try {
              await concludeMutation.mutateAsync({ hostId: currentUserId });
              router.push(`/room/${id}/feedback`);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to conclude activity');
            }
          },
        },
      ]
    );
  }, [id, currentUserId, concludeMutation, router]);

  const handleLeaveSquad = useCallback(() => {
    if (!id || !currentUserId || isLeaving) return;

    Alert.alert(
      'Leave Squad',
      'Are you sure you want to leave this squad? You will no longer have access to this room.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            const mySquadsKey = queryKeys.activities.mySquads(currentUserId);

            // 1. Snapshot current squad list for rollback
            const previousSquads = queryClient.getQueryData<MySquadItem[]>(mySquadsKey);

            // 2. Optimistically remove from My Squads cache
            queryClient.setQueryData<MySquadItem[]>(mySquadsKey, (old = []) =>
              old.filter((s) => s.id !== id)
            );

            // 3. Immediately transition UI away from the room (0ms latency)
            router.replace('/(main)/my-activities');

            // 4. Fire background RPC mutation with rollback on error
            try {
              const res = await leaveSquad(id, currentUserId);
              if (!res.success) {
                // Rollback cache and inform user
                queryClient.setQueryData(mySquadsKey, previousSquads);
                Alert.alert('Unable to leave squad', res.error || 'Please check your connection.');
                return;
              }
              // Succeeded: invalidate related queries to confirm consistency
              void queryClient.invalidateQueries({ queryKey: mySquadsKey });
              void queryClient.invalidateQueries({ queryKey: queryKeys.room.meta(id) });
              void queryClient.invalidateQueries({ queryKey: queryKeys.room.messages(id) });
              void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.all() });
            } catch (err) {
              queryClient.setQueryData(mySquadsKey, previousSquads);
              Alert.alert(
                'Unable to leave squad',
                err instanceof Error ? err.message : 'Please check your connection.'
              );
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  }, [id, currentUserId, isLeaving, queryClient, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      {/* Ephemeral Header */}
      <View
        style={{ paddingTop: Math.max(insets.top, 16) }}
        className="bg-ink border-b border-hairline px-5 pb-3"
      >
        <View className="flex-row justify-between items-center mb-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to main"
            onPress={() => router.replace('/(main)')}
            className="w-11 h-11 rounded-full bg-ink-raised border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="flex-row items-center gap-2">
            {isConcluded ? (
              <View className="flex-row items-center px-3 py-1.5 rounded-full border border-signal-violet/40 bg-signal-violet/10">
                <CheckCircle2 size={12} color="#C77DFF" />
                <Text className="text-pulse-lilac font-mono text-2xs font-bold ml-1.5">
                  Meetup Concluded
                </Text>
              </View>
            ) : (
              <Animated.View
                style={[
                  {
                    borderColor: isExpired
                      ? '#7B2FF7'
                      : urgency === 'expiring'
                      ? '#FF6B5E'
                      : theme.badgeBorder,
                    backgroundColor: isExpired
                      ? '#17131F'
                      : urgency === 'expiring'
                      ? '#2A1115'
                      : theme.bg,
                    opacity: pulseAnim,
                  },
                ]}
                className="flex-row items-center px-3 py-1.5 rounded-full border"
              >
                <Clock
                  size={12}
                  color={
                    isExpired ? '#C77DFF' : urgency === 'expiring' ? '#FF6B5E' : theme.primary
                  }
                />
                <Text
                  style={{
                    color: isExpired
                      ? '#C77DFF'
                      : urgency === 'expiring'
                      ? '#FFB4AB'
                      : theme.badgeText,
                  }}
                  className="font-mono text-2xs font-bold ml-1.5"
                >
                  {isExpired ? 'Squad Room Active' : `Joining closes in ${formattedTtl}`}
                </Text>
              </Animated.View>
            )}

            {isHost && !isConcluded && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Conclude activity"
                disabled={concludeMutation.isPending}
                onPress={handleHostConclude}
                className="px-2.5 py-1.5 rounded-full bg-signal-violet/20 border border-signal-violet flex-row items-center active:bg-signal-violet/30"
              >
                <CheckCircle2 size={13} color="#C77DFF" style={{ marginRight: 4 }} />
                <Text className="text-pulse-lilac font-display font-bold text-2xs">
                  Conclude
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Leave squad"
              disabled={isLeaving}
              onPress={handleLeaveSquad}
              className="w-9 h-9 rounded-full bg-ink-raised border border-hairline items-center justify-center active:bg-ember/20"
              activeOpacity={0.7}
            >
              <LogOut size={16} color="#FF6B5E" />
            </TouchableOpacity>
          </View>
        </View>

        <Text className="text-moonlight font-display text-lg font-bold">
          {title}
        </Text>
        {venueName ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View venue location"
            onPress={() => setShowVenueModal(true)}
            className="flex-row items-center mt-1 self-start bg-ink-raised px-2.5 py-1 rounded-full border border-hairline active:bg-signal-violet/20"
          >
            <MapPin size={12} color="#D2BBFF" />
            <Text className="text-signal-violet-light font-body text-xs ml-1 font-medium">
              Venue: {venueName}
            </Text>
            <ExternalLink size={10} color="#A99BC2" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Post-Concluded Feedback Banner */}
      {isConcluded && (
        <View className="bg-signal-violet/15 border-b border-signal-violet/30 px-5 py-2.5 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Sparkles size={14} color="#C77DFF" style={{ marginRight: 6 }} />
            <Text className="text-moonlight text-xs font-medium">
              Meetup concluded! Share feedback with squad.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Rate squad members"
            onPress={() => router.push(`/room/${id}/feedback`)}
            className="px-3 py-1 bg-signal-violet rounded-full active:scale-95"
          >
            <Text className="text-void font-bold text-2xs">Rate Squad</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Feed */}
      <ScrollView testID="room-messages"
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        {roomError ? <Text className="text-ember text-xs mb-3">{roomError}</Text> : null}
        <View className="flex-row items-center justify-center p-2.5 rounded-2xl bg-ink border border-hairline mb-4">
          <ShieldAlert size={12} color="#A99BC2" />
          <Text className="text-dusk text-2xs font-mono ml-1.5">
            Squad Room • Only accepted members and host can chat.
          </Text>
        </View>

        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId || m.senderName === 'You';
          return (
            <View
              key={m.id}
              className={`mb-3 max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}
            >
              <View className="flex-row items-center mb-1">
                <Text className="text-dusk font-bold text-2xs mr-1.5">
                  {m.senderName}
                </Text>
                <Text className="text-dusk/60 text-2xs font-mono">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <View
                className={`p-3.5 rounded-2xl ${
                  isMe
                    ? 'bg-signal-violet rounded-tr-none'
                    : 'bg-ink border border-hairline rounded-tl-none'
                }`}
              >
                <Text
                  className={`text-sm ${
                    isMe ? 'text-moonlight font-medium' : 'text-moonlight font-normal'
                  }`}
                >
                  {m.content}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Message Input Box */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="p-3 bg-ink border-t border-hairline flex-row items-center"
      >
        <TextInput
          accessibilityLabel="Room Message Input"
          value={input}
          onChangeText={setInput}
          placeholder="Send a message to squad..."
          placeholderTextColor="#5A536B"
          className="flex-1 bg-void border border-hairline rounded-full px-4 py-3 text-moonlight text-base mr-2 focus:border-signal-violet"
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Send Room Message"
          disabled={!input.trim() || sendMutation.isPending}
          onPress={handleSend}
          className={`w-11 h-11 bg-signal-violet rounded-full items-center justify-center border border-signal-violet-light/30 ${
            !input.trim() || sendMutation.isPending ? 'opacity-40' : ''
          }`}
          activeOpacity={0.8}
        >
          <Send size={16} color="#F5F0FF" />
        </TouchableOpacity>
      </View>

      {/* Venue Location Modal */}
      <VenueLocationModal
        visible={showVenueModal}
        onClose={() => setShowVenueModal(false)}
        venueName={venueName}
        coordinates={exactLocation}
        isLoading={isLocationLoading}
      />
    </KeyboardAvoidingView>
  );
}
