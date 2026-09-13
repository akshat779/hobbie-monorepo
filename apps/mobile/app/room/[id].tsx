import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Send, MapPin, Clock, ShieldAlert } from 'lucide-react-native';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import {
  useRoomMetadataQuery,
  useRoomMessagesQuery,
  useSendRoomMessageMutation,
  setupRealtimeRoomSync,
} from '../../src/features/room/useRoomQuery';

import { useCountdown } from '../../src/hooks/useCountdown';

export default function ActiveEphemeralRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [input, setInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);

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

          <View
            style={{
              borderColor: isExpired ? '#2C2739' : theme.badgeBorder,
              backgroundColor: isExpired ? '#17131F' : theme.bg,
            }}
            className="flex-row items-center px-3 py-1.5 rounded-full border"
          >
            <Clock size={12} color={isExpired ? '#5A536B' : theme.primary} />
            <Text
              style={{ color: isExpired ? '#A99BC2' : theme.badgeText }}
              className="font-mono text-2xs font-bold ml-1.5"
            >
              {isExpired ? 'Squad Expired' : `Self-Destructs in ${formattedTtl}`}
            </Text>
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
            All messages are ephemeral and wipe automatically upon expiry.
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
          editable={!isExpired}
          placeholder={isExpired ? 'Squad expired — room is locked' : 'Send an ephemeral message...'}
          placeholderTextColor="#5A536B"
          className={`flex-1 bg-void border border-hairline rounded-full px-4 py-3 text-moonlight text-base mr-2 ${
            isExpired ? 'opacity-50' : 'focus:border-signal-violet'
          }`}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Send Room Message"
          disabled={isExpired || !input.trim() || sendMutation.isPending}
          onPress={handleSend}
          className={`w-11 h-11 bg-signal-violet rounded-full items-center justify-center border border-signal-violet-light/30 ${
            isExpired || !input.trim() || sendMutation.isPending ? 'opacity-40' : ''
          }`}
          activeOpacity={0.8}
        >
          <Send size={16} color="#F5F0FF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
