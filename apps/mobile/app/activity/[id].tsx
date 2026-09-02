import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldCheck, Clock, MapPin, Send } from 'lucide-react-native';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [requestSent, setRequestSent] = useState(false);
  const [message, setMessage] = useState('');

  const handleJoin = () => {
    setRequestSent(true);
    // Simulate instant acceptance for dev persona testing
    setTimeout(() => {
      router.replace(`/room/${id}`);
    }, 1200);
  };

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

          <View className="w-10" />
        </View>

        <Text className="text-moonlight font-display text-2xl font-extrabold tracking-tight mb-1">
          5-a-side Turf Football
        </Text>
        <View className="flex-row items-center mb-4">
          <Clock size={12} color="#C77DFF" />
          <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1.5">
            2h 25m remaining before self-destruct
          </Text>
        </View>

        {/* Host Identity Card */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4 shadow-lg">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-moonlight font-bold font-display text-base">
              Host: Alex Rivera
            </Text>
            <View className="bg-signal-violet/20 border border-signal-violet px-2.5 py-0.5 rounded-full flex-row items-center">
              <ShieldCheck size={12} color="#D2BBFF" />
              <Text className="text-signal-violet-light text-[11px] font-bold ml-1">
                Verified
              </Text>
            </View>
          </View>
          <Text className="text-dusk font-body text-xs leading-relaxed">
            Looking for 2 more players for a casual 5-a-side match. Beginner to
            intermediate level. We have bibs and football ready.
          </Text>
        </View>

        {/* Approximate Venue Card */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-5">
          <View className="flex-row items-center mb-1">
            <MapPin size={14} color="#C77DFF" />
            <Text className="text-moonlight font-bold font-display text-sm ml-1.5">
              Geofenced Location
            </Text>
          </View>
          <Text className="text-dusk font-body text-xs leading-relaxed">
            Near EcoWorld Tech Park (Exact venue pin is revealed upon host approval)
          </Text>
        </View>

        {/* Message Input */}
        {!requestSent ? (
          <View className="mb-4">
            <Text className="text-dusk text-xs uppercase font-semibold tracking-wider mb-2 ml-1">
              Note to host (optional)
            </Text>
            <TextInput
              placeholder="e.g. I can play defense or striker!"
              placeholderTextColor="#5A536B"
              value={message}
              onChangeText={setMessage}
              className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight text-sm focus:border-signal-violet"
            />
          </View>
        ) : (
          <View className="bg-ink-raised border border-signal-violet p-5 rounded-3xl items-center mb-4">
            <Text className="text-pulse-lilac font-display font-bold text-base mb-1">
              Join Request Sent!
            </Text>
            <Text className="text-dusk text-xs text-center">
              Waiting for Alex to approve. Entering ephemeral room...
            </Text>
          </View>
        )}
      </ScrollView>

      {!requestSent && (
        <TouchableOpacity
          onPress={handleJoin}
          className="w-full h-14 bg-signal-violet rounded-full flex-row items-center justify-center shadow-lg"
          activeOpacity={0.8}
        >
          <Send size={16} color="#F5F0FF" style={{ marginRight: 8 }} />
          <Text className="text-moonlight font-display text-base font-bold">
            Request to Join Squad
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
