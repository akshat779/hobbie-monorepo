import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Clock, ArrowRight } from 'lucide-react-native';

export default function MyActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5 pb-8"
    >
      <View className="mb-5">
        <View className="flex-row items-center space-x-2 mb-1">
          <Users size={20} color="#C77DFF" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac ml-1.5">
            Squad Coordination
          </Text>
        </View>
        <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
          My Squads
        </Text>
        <Text className="text-xs text-dusk">
          Your active rooms and upcoming ephemeral squads.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="bg-ink border border-signal-violet/60 p-5 rounded-3xl mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-moonlight font-bold font-display text-base">
              5-a-side Turf Football
            </Text>
            <View className="bg-signal-violet/20 border border-signal-violet px-2.5 py-0.5 rounded-full">
              <Text className="text-signal-violet-light text-[10px] font-bold">
                Live Squad
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mb-3">
            <Clock size={12} color="#FF6B5E" />
            <Text className="text-ember font-mono text-xs font-bold ml-1.5">
              Self-Destructs in 2h 15m
            </Text>
          </View>

          <Text className="text-dusk text-xs mb-4">
            Host: Alex • 3 / 10 players ready • EcoWorld Pitch 2
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/room/act-1')}
            className="w-full h-12 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
            activeOpacity={0.8}
          >
            <Text className="text-moonlight font-display text-xs font-bold mr-1.5">
              Enter Squad Chat & Venue
            </Text>
            <ArrowRight size={14} color="#F5F0FF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
