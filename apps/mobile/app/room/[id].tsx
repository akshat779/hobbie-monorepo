import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Send,
  MapPin,
  ShieldAlert,
  LogOut,
  CheckCircle2,
  Sparkles,
  MoreHorizontal,
  Crown,
} from 'lucide-react-native';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import {
  useRoomMetadataQuery,
  useRoomMessagesQuery,
  useRoomMembersQuery,
  useSendRoomMessageMutation,
  useActivityExactLocationQuery,
  useConcludeActivityMutation,
  setupRealtimeRoomSync,
} from '../../src/features/room/useRoomQuery';
import { RoomMembersSheet } from '../../src/features/room/RoomMembersSheet';
import { VenueLocationModal } from '../../src/features/room/VenueLocationModal';
import { leaveSquad } from '../../src/services/handshake';
import { queryKeys } from '../../src/services/queryKeys';
import { MySquadItem } from '../../src/features/activity/useMyActivitiesQuery';
import { Avatar } from '../../src/components/common/Avatar';
import { useBackToMySquads } from '../../src/hooks/useBackToMySquads';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const [showMembers, setShowMembers] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const { data: roomMeta } = useRoomMetadataQuery(id);
  const { data: messages = [], error: messagesQueryError } = useRoomMessagesQuery(id);
  const { data: members = [] } = useRoomMembersQuery(id);
  const { data: exactLocation, isLoading: isLocationLoading } = useActivityExactLocationQuery(id);
  const sendMutation = useSendRoomMessageMutation(id || '');
  const concludeMutation = useConcludeActivityMutation(id || '');

  const title = roomMeta?.title || 'Squad Chat';
  const venueName = roomMeta?.venueName;
  const isHost = currentUserId === roomMeta?.hostId;
  const isConcluded = roomMeta?.status === 'concluded';

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Back always returns to My Squads using the reverse (pop) transition.
  const goBackToMySquads = useBackToMySquads();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackToMySquads();
        return true;
      });
      return () => subscription.remove();
    }, [goBackToMySquads])
  );

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

  const openMemberProfile = useCallback(
    (userId: string) => {
      if (!UUID_PATTERN.test(userId)) return;
      router.push(`/profile/${userId}`);
    },
    [router]
  );

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
    setShowActions(false);
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
    setShowActions(false);

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
            goBackToMySquads();

            // 4. Fire background RPC mutation with rollback on error
            try {
              const res = await leaveSquad(id, currentUserId);
              if (!res.success) {
                queryClient.setQueryData(mySquadsKey, previousSquads);
                Alert.alert('Unable to leave squad', res.error || 'Please check your connection.');
                return;
              }
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
  }, [id, currentUserId, isLeaving, queryClient, goBackToMySquads]);

  const stackMembers = members.slice(0, 4);
  const overflowCount = Math.max(0, members.length - stackMembers.length);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      {/* Header: back | centered title + member stack | overflow */}
      <View
        style={{ paddingTop: Math.max(insets.top, 16) }}
        className="bg-ink border-b border-hairline px-4 pb-3"
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to My Squads"
            onPress={goBackToMySquads}
            className="w-10 h-10 rounded-full bg-ink-raised border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="View squad members"
            onPress={() => setShowMembers(true)}
            className="flex-1 items-center px-2"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              {stackMembers.map((member, index) => (
                <View
                  key={member.id}
                  style={{ marginLeft: index === 0 ? 0 : -11 }}
                  className="rounded-full border-2 border-ink"
                >
                  <Avatar name={member.name} url={member.avatarUrl ?? null} size={30} />
                </View>
              ))}
              {overflowCount > 0 ? (
                <View
                  style={{ marginLeft: -11 }}
                  className="w-[30px] h-[30px] rounded-full border-2 border-ink bg-ink-raised items-center justify-center"
                >
                  <Text className="text-moonlight text-2xs font-bold">+{overflowCount}</Text>
                </View>
              ) : null}
              <Text className="text-dusk text-2xs ml-2">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>

            <Text
              numberOfLines={1}
              style={{ maxWidth: '65%' }}
              className="text-moonlight font-display text-base font-bold mt-1"
            >
              {title}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Squad actions"
            onPress={() => setShowActions(true)}
            className="w-10 h-10 rounded-full bg-ink-raised border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <MoreHorizontal size={20} color="#F5F0FF" />
          </TouchableOpacity>
        </View>
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
      <ScrollView testID="room-messages" className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {roomError ? <Text className="text-ember text-xs mb-3">{roomError}</Text> : null}

        {/* System line anchoring the conversation */}
        <View className="items-center mb-4">
          <View className="flex-row items-center">
            <ShieldAlert size={11} color="#A99BC2" />
            <Text className="text-dusk/70 text-2xs font-mono ml-1.5">
              Squad room • only accepted members and the host can chat.
            </Text>
          </View>
        </View>

        {messages.map((m) => {
          const isMe = m.senderId === currentUserId || m.senderName === 'You';
          const member = memberById.get(m.senderId);
          const displayName = member?.name ?? m.senderName;
          const isHostMsg = member?.isHost ?? m.isHost;
          const canOpen = UUID_PATTERN.test(m.senderId);

          if (isMe) {
            return (
              <View key={m.id} className="mb-3 items-end">
                <Text className="text-dusk/60 text-2xs font-mono mb-1">
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
                <View className="max-w-[80%] p-3.5 rounded-2xl rounded-tr-none bg-signal-violet">
                  <Text className="text-sm text-moonlight font-medium">{m.content}</Text>
                </View>
              </View>
            );
          }

          return (
            <View key={m.id} className="mb-3 flex-row items-end">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View ${displayName}'s profile`}
                onPress={() => openMemberProfile(m.senderId)}
                disabled={!canOpen}
                className="mr-2"
                activeOpacity={0.7}
              >
                <Avatar name={displayName} url={member?.avatarUrl ?? null} size={28} />
              </TouchableOpacity>

              <View className="max-w-[78%] items-start">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`View ${displayName}'s profile`}
                  onPress={() => openMemberProfile(m.senderId)}
                  disabled={!canOpen}
                  className="flex-row items-center mb-1"
                  activeOpacity={0.7}
                >
                  <Text className="text-dusk font-bold text-2xs mr-1.5">{displayName}</Text>
                  {isHostMsg ? <Crown size={10} color="#C77DFF" /> : null}
                  <Text className="text-dusk/60 text-2xs font-mono ml-1.5">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
                <View className="p-3.5 rounded-2xl rounded-tl-none bg-ink border border-hairline">
                  <Text className="text-sm text-moonlight">{m.content}</Text>
                </View>
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

      {/* Members sheet */}
      <RoomMembersSheet visible={showMembers} roomId={id || ''} onClose={() => setShowMembers(false)} />

      {/* Actions sheet */}
      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/60 justify-end"
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View
            className="bg-ink rounded-t-3xl border-t border-hairline px-5 pt-4"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="w-10 h-1 rounded-full bg-hairline self-center mb-4" />

            {venueName ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="View venue location"
                onPress={() => {
                  setShowActions(false);
                  setShowVenueModal(true);
                }}
                className="flex-row items-center h-12"
                activeOpacity={0.7}
              >
                <MapPin size={16} color="#D2BBFF" />
                <Text className="text-moonlight text-sm font-medium ml-3">
                  View venue • {venueName}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isHost && !isConcluded ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Conclude activity"
                disabled={concludeMutation.isPending}
                onPress={handleHostConclude}
                className="flex-row items-center h-12"
                activeOpacity={0.7}
              >
                <CheckCircle2 size={16} color="#C77DFF" />
                <Text className="text-moonlight text-sm font-medium ml-3">Conclude meetup</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Leave squad"
              disabled={isLeaving}
              onPress={handleLeaveSquad}
              className="flex-row items-center h-12"
              activeOpacity={0.7}
            >
              <LogOut size={16} color="#FF6B5E" />
              <Text className="text-ember text-sm font-semibold ml-3">Leave squad</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
