import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, MapPin, Clock, ShieldAlert, LogOut } from 'lucide-react-native';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import {
  useRoomMetadataQuery,
  useRoomMessagesQuery,
  useSendRoomMessageMutation,
  setupRealtimeRoomSync,
} from '../../src/features/room/useRoomQuery';
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

  const { data: roomMeta } = useRoomMetadataQuery(id);
  const { data: messages = [], error: messagesQueryError } = useRoomMessagesQuery(id);
  const sendMutation = useSendRoomMessageMutation(id || '');

  const title = roomMeta?.title || 'Squad Chat';
  const venueName = roomMeta?.venueName;
  const expiresAt = roomMeta?.expiresAt || null;

  const { isExpired, formattedTtl, theme } = useCountdown(expiresAt, 5000);

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
            } catch (err: any) {
              queryClient.setQueryData(mySquadsKey, previousSquads);
              Alert.alert('Unable to leave squad', err?.message || 'Please check your connection.');
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
            <View
              style={{
                borderColor: isExpired ? '#7B2FF7' : theme.badgeBorder,
                backgroundColor: isExpired ? '#17131F' : theme.bg,
              }}
              className="flex-row items-center px-3 py-1.5 rounded-full border"
            >
              <Clock size={12} color={isExpired ? '#C77DFF' : theme.primary} />
              <Text
                style={{ color: isExpired ? '#C77DFF' : theme.badgeText }}
                className="font-mono text-2xs font-bold ml-1.5"
              >
                {isExpired ? 'Squad Room Active' : `Joining closes in ${formattedTtl}`}
              </Text>
            </View>

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
          <View className="flex-row items-center mt-0.5">
            <MapPin size={12} color="#D2BBFF" />
            <Text className="text-signal-violet-light font-body text-xs ml-1">
              Unlocked Venue: {venueName}
            </Text>
          </View>
        ) : null}
      </View>

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
    </KeyboardAvoidingView>
  );
}
