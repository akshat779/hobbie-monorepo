import React, { useState } from 'react';
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

interface Message {
  id: string;
  sender: string;
  text: string;
  isMe: boolean;
  time: string;
}

export default function ActiveEphemeralRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Alex (Host)',
      text: 'Hey everyone! Turf is booked for 7:30 PM at EcoWorld pitch 2.',
      isMe: false,
      time: '7:02 PM',
    },
    {
      id: '2',
      sender: 'Sam',
      text: 'Awesome, on my way now!',
      isMe: true,
      time: '7:05 PM',
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'You',
        text: input.trim(),
        isMe: true,
        time: 'Just now',
      },
    ]);
    setInput('');
  };

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
            onPress={() => router.replace('/(main)')}
            className="w-9 h-9 rounded-full bg-ink-raised border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="flex-row items-center px-2.5 py-1 rounded-full bg-ember/15 border border-ember/60">
            <Clock size={11} color="#FF6B5E" />
            <Text className="text-ember font-mono text-[11px] font-bold ml-1.5">
              Self-Destructs in 2h 15m
            </Text>
          </View>
        </View>

        <Text className="text-moonlight font-display text-lg font-bold">
          5-a-side Turf Football
        </Text>
        <View className="flex-row items-center mt-0.5">
          <MapPin size={12} color="#D2BBFF" />
          <Text className="text-signal-violet-light font-body text-xs ml-1">
            Unlocked Venue: Pitch 2, EcoWorld Turf Club
          </Text>
        </View>
      </View>

      {/* Messages Feed */}
      <ScrollView
        className="flex-1 px-4 py-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-center p-2.5 rounded-2xl bg-ink border border-hairline mb-4">
          <ShieldAlert size={12} color="#A99BC2" />
          <Text className="text-dusk text-[11px] font-mono ml-1.5">
            All messages are ephemeral and wipe automatically upon expiry.
          </Text>
        </View>

        {messages.map((m) => (
          <View
            key={m.id}
            className={`mb-3 max-w-[80%] ${
              m.isMe ? 'self-end' : 'self-start'
            }`}
          >
            <View className="flex-row items-center mb-1">
              <Text className="text-dusk font-bold text-[10px] mr-1.5">
                {m.sender}
              </Text>
              <Text className="text-dusk/60 text-[9px] font-mono">
                {m.time}
              </Text>
            </View>
            <View
              className={`p-3.5 rounded-2xl ${
                m.isMe
                  ? 'bg-signal-violet rounded-tr-none'
                  : 'bg-ink border border-hairline rounded-tl-none'
              }`}
            >
              <Text
                className={`text-sm ${
                  m.isMe ? 'text-moonlight font-medium' : 'text-moonlight font-normal'
                }`}
              >
                {m.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Message Input Box */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="p-3 bg-ink border-t border-hairline flex-row items-center"
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Send an ephemeral message..."
          placeholderTextColor="#5A536B"
          className="flex-1 bg-void border border-hairline rounded-full px-4 py-3 text-moonlight text-sm mr-2 focus:border-signal-violet"
        />
        <TouchableOpacity
          onPress={handleSend}
          className="w-11 h-11 bg-signal-violet rounded-full items-center justify-center border border-signal-violet-light/30"
          activeOpacity={0.8}
        >
          <Send size={16} color="#F5F0FF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
