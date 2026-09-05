import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  INTEREST_CATEGORIES,
  InterestId,
  CreateActivitySchema,
  fuzzCoordinates,
  toEwktPoint,
} from '@hobbie/shared';
import {
  ChevronLeft,
  Users,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { useUserLocation } from '../../src/hooks/useUserLocation';

const PARTICIPANT_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
const TTL_OPTIONS = [1, 2, 3, 4];

export default function CreateActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, profile } = useAuthStore();
  const { coords: userLocation, cityName } = useUserLocation();

  const [selectedInterest, setSelectedInterest] = useState<InterestId>('football');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [ttlHours, setTtlHours] = useState(3);
  const [filterGender, setFilterGender] = useState<'any' | 'male-only' | 'female-only'>('any');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePost = async () => {
    try {
      setErrorMessage(null);

      const hostId = user?.id || profile?.id;
      if (!hostId) {
        setErrorMessage('Please sign in or select a dev persona to host a squad.');
        return;
      }

      // 1. Zod Validation
      const validationPayload = {
        interestId: selectedInterest,
        title: title.trim(),
        description: description.trim(),
        tier: 'physical' as const,
        location: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
        venueName: venueName.trim() || undefined,
        ttlHours,
        maxParticipants,
        filterGender,
      };

      const parsed = CreateActivitySchema.safeParse(validationPayload);
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Invalid form input';
        setErrorMessage(firstError);
        return;
      }

      setIsSubmitting(true);

      // 2. PostGIS Geometry & Privacy Fuzzing Calculation (~100m displacement)
      const exactCoords = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
      const fuzzedCoords = fuzzCoordinates(exactCoords);

      const exactEwkt = toEwktPoint(exactCoords);
      const fuzzedEwkt = toEwktPoint(fuzzedCoords);

      // 3. Ephemeral TTL Expiration Timestamp
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

      // 4. Insert into Supabase activities table
      const { data, error } = await supabase
        .from('activities')
        .insert({
          host_id: hostId,
          interest_id: selectedInterest,
          title: title.trim(),
          description: description.trim(),
          tier: 'physical',
          location: exactEwkt,
          fuzzed_location: fuzzedEwkt,
          venue_name: venueName.trim() || null,
          ttl_hours: ttlHours,
          expires_at: expiresAt,
          max_participants: maxParticipants,
          current_participants_count: 1,
          filter_gender: filterGender,
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        console.error('Squad creation error:', error);
        setErrorMessage(error.message || 'Failed to create squad.');
        setIsSubmitting(false);
        return;
      }

      // 5. Invalidate Discovery and Activities Cache
      await queryClient.invalidateQueries({ queryKey: ['discovery'] });

      // 6. Navigate back to discovery map
      router.replace('/(main)');
    } catch (err: any) {
      console.error('Creation catch error:', err);
      setErrorMessage(err?.message || 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      <ScrollView
        style={{
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        className="flex-1 px-5"
      >
        {/* Navigation Bar */}
        <View className="flex-row justify-between items-center mb-5 pt-1">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-moonlight font-display text-lg font-bold">
              Host Live Squad
            </Text>
            <Text className="text-dusk font-mono text-[11px]">
              Near {cityName}
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-dusk font-body text-sm font-semibold">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View className="bg-ember/15 border border-ember/60 p-3 rounded-2xl mb-4">
            <Text className="text-ember font-body text-xs font-semibold">
              {errorMessage}
            </Text>
          </View>
        )}

        {/* Category Picker */}
        <Text className="text-dusk font-body text-xs mb-2 uppercase font-semibold tracking-wider">
          Interest Category
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-5 -mx-1 px-1"
        >
          {INTEREST_CATEGORIES.map((cat) => {
            const isSelected = selectedInterest === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedInterest(cat.id)}
                className={`px-4 py-2.5 rounded-full border mr-2.5 flex-row items-center ${
                  isSelected
                    ? 'bg-signal-violet border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs ${
                    isSelected ? 'text-moonlight font-bold' : 'text-dusk'
                  }`}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Title Input */}
        <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold tracking-wider">
          Squad Title *
        </Text>
        <TextInput
          placeholder="e.g. 5-a-side Turf Football match"
          placeholderTextColor="#5A536B"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight font-body text-sm mb-4 focus:border-signal-violet"
        />

        {/* Description Input */}
        <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold tracking-wider">
          Details & Vibe
        </Text>
        <TextInput
          placeholder="Need 2 more players. Casual, beginner friendly, bibs provided!"
          placeholderTextColor="#5A536B"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          className="border border-hairline bg-ink rounded-2xl px-4 py-3 text-moonlight font-body text-sm mb-4 h-24 focus:border-signal-violet"
        />

        {/* Venue Name Input */}
        <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold tracking-wider">
          Venue / Landmark (Optional)
        </Text>
        <TextInput
          placeholder="e.g. EcoWorld Turf Club Pitch 2"
          placeholderTextColor="#5A536B"
          value={venueName}
          onChangeText={setVenueName}
          maxLength={100}
          className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight font-body text-sm mb-5 focus:border-signal-violet"
        />

        {/* Squad Capacity Selector */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider">
              Squad Capacity
            </Text>
            <View className="flex-row items-center">
              <Users size={12} color="#C77DFF" />
              <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1">
                {maxParticipants} Total Players
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {PARTICIPANT_OPTIONS.map((count) => {
              const isSelected = maxParticipants === count;
              return (
                <TouchableOpacity
                  key={count}
                  onPress={() => setMaxParticipants(count)}
                  className={`flex-1 py-2.5 rounded-2xl border items-center ${
                    isSelected
                      ? 'bg-signal-violet border-signal-violet'
                      : 'bg-ink border-hairline'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-mono text-xs ${
                      isSelected ? 'text-moonlight font-bold' : 'text-dusk'
                    }`}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Broadcast TTL Picker */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider">
              Broadcast TTL (Self-Destructs After)
            </Text>
            <View className="flex-row items-center">
              <Clock size={12} color="#C77DFF" />
              <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1">
                {ttlHours} Hours
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {TTL_OPTIONS.map((hours) => {
              const isSelected = ttlHours === hours;
              return (
                <TouchableOpacity
                  key={hours}
                  onPress={() => setTtlHours(hours)}
                  className={`flex-1 py-2.5 rounded-2xl border items-center ${
                    isSelected
                      ? 'bg-signal-violet border-signal-violet'
                      : 'bg-ink border-hairline'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-mono text-xs ${
                      isSelected ? 'text-moonlight font-bold' : 'text-dusk'
                    }`}
                  >
                    {hours}h
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Privacy & Anti-Stalking Fuzzing Notice */}
        <View className="bg-ink border border-hairline p-4 rounded-3xl mb-6">
          <View className="flex-row items-center mb-1.5">
            <MapPin size={14} color="#C77DFF" />
            <Text className="text-pulse-lilac font-bold text-xs ml-1.5">
              Privacy Fuzzing Active (~100m)
            </Text>
          </View>
          <Text className="text-dusk text-xs leading-relaxed">
            Your location is automatically offset by ~100m on the public map.
            Exact venue and live coordinates are only unlocked to accepted squad members.
          </Text>
        </View>

        {/* Submit Broadcast CTA */}
        <TouchableOpacity
          onPress={handlePost}
          disabled={!title.trim() || isSubmitting}
          className={`w-full py-4 rounded-full items-center mb-6 flex-row justify-center border ${
            title.trim() && !isSubmitting
              ? 'bg-signal-violet border-signal-violet-light/30'
              : 'bg-ink border-hairline opacity-50'
          }`}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#F5F0FF" />
          ) : (
            <>
              <Sparkles size={16} color="#F5F0FF" style={{ marginRight: 8 }} />
              <Text className="text-moonlight font-display text-base font-bold">
                Broadcast Live Squad ({ttlHours}h TTL)
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
