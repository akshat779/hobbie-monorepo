import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INTEREST_CATEGORIES, InterestId } from '@hobbie/shared';

export default function CreateActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedInterest, setSelectedInterest] =
    useState<InterestId>('football');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ttlHours, setTtlHours] = useState(3);

  const handlePost = () => {
    if (!title.trim()) return;
    router.replace('/(main)');
  };

  return (
    <ScrollView
      style={{
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
      className="flex-1 bg-void px-6"
    >
      <View className="flex-row justify-between items-center mb-6 pt-2">
        <Text className="text-moonlight font-display text-2xl font-bold">
          Post Live Squad
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-dusk font-body text-sm font-semibold">Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Category selector */}
      <Text className="text-dusk font-body text-xs mb-2 uppercase font-semibold">Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-5"
      >
        {INTEREST_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedInterest(cat.id)}
            className={`px-4 py-2 rounded-full border mr-2 ${
              selectedInterest === cat.id
                ? 'bg-signal-violet border-signal-violet'
                : 'bg-ink border-hairline'
            }`}
          >
            <Text
              className={`text-xs ${
                selectedInterest === cat.id
                  ? 'text-moonlight font-bold'
                  : 'text-dusk'
              }`}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Title */}
      <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold">Activity Title</Text>
      <TextInput
        placeholder="e.g. 5-a-side Football Turf match"
        placeholderTextColor="#5A536B"
        value={title}
        onChangeText={setTitle}
        className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight font-body text-sm mb-4 focus:border-signal-violet"
      />

      {/* Description */}
      <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold">
        Description & Details
      </Text>
      <TextInput
        placeholder="Need 2 more players, beginner-friendly..."
        placeholderTextColor="#5A536B"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
        className="border border-hairline bg-ink rounded-2xl px-4 py-3 text-moonlight font-body text-sm mb-4 h-24 focus:border-signal-violet"
      />

      {/* Ephemeral TTL Slider / Picker */}
      <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold">
        Broadcast TTL (Self-Destructs After)
      </Text>
      <View className="flex-row gap-2 mb-4">
        {[1, 2, 3, 4].map((hours) => (
          <TouchableOpacity
            key={hours}
            onPress={() => setTtlHours(hours)}
            className={`flex-1 py-2.5 rounded-full border items-center ${
              ttlHours === hours
                ? 'bg-signal-violet border-signal-violet'
                : 'bg-ink border-hairline'
            }`}
          >
            <Text
              className={`font-mono text-xs ${
                ttlHours === hours
                  ? 'text-moonlight font-bold'
                  : 'text-dusk'
              }`}
            >
              {hours}h
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Privacy Notice */}
      <View className="bg-ink border border-hairline p-4 rounded-2xl mb-8">
        <Text className="text-signal-violet-light font-bold text-xs mb-1">
          🔒 Privacy Fuzzing Active
        </Text>
        <Text className="text-dusk text-xs leading-4">
          Your location will be fuzzed by ~100m on the public map. Exact venue
          is revealed only to players you accept into the room.
        </Text>
      </View>

      <TouchableOpacity
        onPress={handlePost}
        disabled={!title.trim()}
        className={`w-full py-4 rounded-full items-center shadow-lg mb-10 ${
          title.trim()
            ? 'bg-signal-violet'
            : 'bg-ink border border-hairline opacity-50'
        }`}
      >
        <Text className="text-moonlight font-display text-base font-bold">
          Broadcast Squad ({ttlHours}h TTL)
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
