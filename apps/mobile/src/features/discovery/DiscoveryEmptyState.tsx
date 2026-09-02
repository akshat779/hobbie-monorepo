import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Radio, Plus } from 'lucide-react-native';

interface DiscoveryEmptyStateProps {
  category?: string;
  onResetFilter?: () => void;
}

export function DiscoveryEmptyState({
  category,
  onResetFilter,
}: DiscoveryEmptyStateProps) {
  const router = useRouter();
  const isFiltered = category && category !== 'all';

  return (
    <View className="bg-ink/95 border border-hairline p-6 rounded-3xl items-center mx-5 my-auto backdrop-blur-md">
      {/* Icon Bubble */}
      <View className="w-16 h-16 rounded-full bg-ink-raised border border-hairline items-center justify-center mb-4">
        <Radio size={28} color="#C77DFF" />
      </View>

      <Text className="text-moonlight font-display text-lg font-bold text-center mb-1.5">
        {isFiltered ? 'No Squads for this Category' : 'Radar Clear — No Active Squads'}
      </Text>

      <Text className="text-dusk font-body text-xs text-center px-4 leading-relaxed mb-5">
        {isFiltered
          ? 'Try switching to "All Squads" or be the first to host an activity in this category!'
          : 'No live squads within your 4.5km radius right now. Host your own activity to start matching nearby.'}
      </Text>

      <View className="w-full flex-row space-x-3">
        {isFiltered && onResetFilter && (
          <TouchableOpacity
            onPress={onResetFilter}
            className="flex-1 h-12 bg-ink border border-hairline rounded-full items-center justify-center mr-2"
            activeOpacity={0.75}
          >
            <Text className="text-dusk font-display text-xs font-semibold">
              View All Squads
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.push('/activity/create')}
          className="flex-1 h-12 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
          activeOpacity={0.85}
        >
          <Plus size={16} color="#F5F0FF" style={{ marginRight: 6 }} />
          <Text className="text-moonlight font-display text-xs font-bold">
            Host a Squad
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
