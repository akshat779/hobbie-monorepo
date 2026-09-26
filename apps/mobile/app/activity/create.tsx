import React, { useEffect, useState } from 'react';
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
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import darkMapStyle from '../../src/theme/dark-map-style.json';
import {
  INTEREST_CATEGORIES,
  InterestId,
} from '@hobbie/shared';
import {
  ChevronLeft,
  Users,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Search,
  LocateFixed,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { useCreateActivityMutation } from '../../src/features/activity/useActivityMutations';
import { useUserLocation } from '../../src/hooks/useUserLocation';
import { searchLocation } from '../../src/services/locationSearch';
import { StepSlider } from '../../src/components/common/StepSlider';
import { RangeSlider } from '../../src/components/common/RangeSlider';

const TTL_OPTIONS = [1, 2, 3, 4];

const CATEGORY_ICONS: Record<InterestId, string> = {
  football: '⚽',
  badminton: '🏸',
  table_tennis: '🏓',
  gym_fitness: '🏋️',
  running: '🏃',
  cafe_coffee: '☕',
  coworking: '💻',
  coding_tech: '⚡',
  board_games: '🎲',
  nightlife: '🍸',
};

export default function CreateActivityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreateActivityMutation();
  const { coords: userLocation, cityName, isLiveGps, isLoading: isLocationLoading, error: locationError } = useUserLocation();

  const [selectedInterest, setSelectedInterest] = useState<InterestId>('football');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(userLocation);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState('Current location');
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [ttlHours, setTtlHours] = useState(3);
  const [filterGender, setFilterGender] = useState<'any' | 'male-only' | 'female-only'>('any');
  const [isAnyAge, setIsAnyAge] = useState(true);
  const [ageRange, setAgeRange] = useState<[number, number]>([21, 35]);

  const isSubmitting = createMutation.isPending;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isCustomLocation) {
      setSelectedLocation(userLocation);
      if (isLiveGps) setSelectedLocationLabel(cityName);
    }
  }, [cityName, isCustomLocation, isLiveGps, userLocation]);

  const useCurrentLocation = () => {
    setSelectedLocation(userLocation);
    setSelectedLocationLabel(isLiveGps ? cityName : 'Current device location unavailable');
    setIsCustomLocation(false);
  };

  const searchForLocation = async () => {
    const query = locationSearch.trim();
    if (!query) return;
    setIsSearchingLocation(true);
    setErrorMessage(null);
    try {
      const result = await searchLocation(query);
      setSelectedLocation(result.coordinates);
      setSelectedLocationLabel(result.label);
      setVenueName(query);
      setIsCustomLocation(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Location search failed.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handlePost = async () => {
    try {
      setErrorMessage(null);

      const hostId = user?.id;
      if (!hostId) {
        setErrorMessage('Please sign in or select a dev persona to host a squad.');
        return;
      }

      const activityInput = {
        interestId: selectedInterest,
        title: title.trim(),
        description: description.trim(),
        tier: 'physical' as const,
        location: selectedLocation,
        venueName: venueName.trim() || undefined,
        ttlHours,
        maxParticipants,
        filterGender,
        filterAgeMin: isAnyAge ? undefined : ageRange[0],
        filterAgeMax: isAnyAge ? undefined : (ageRange[1] >= 65 ? undefined : ageRange[1]),
      };

      await createMutation.mutateAsync({
        hostId,
        input: activityInput,
      });

      // Navigate back to discovery map
      router.replace('/(main)');
    } catch (err) {
      console.error('Creation catch error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  return (
    <KeyboardAvoidingView
      accessible={false}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      {/* Pinned Navigation Bar */}
      <View
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="px-5 pb-3 bg-void border-b border-hairline/40 flex-row justify-between items-center"
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="w-11 h-11 rounded-full bg-ink border border-hairline items-center justify-center"
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#F5F0FF" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-moonlight font-display text-lg font-bold">
            Host Live Squad
          </Text>
          <Text className="text-dusk font-mono text-2xs">
            Near {cityName}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cancel squad creation"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => router.back()}
          className="min-h-[44px] justify-center px-1"
        >
          <Text className="text-dusk font-body text-sm font-semibold">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
      >

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
                accessibilityRole="button"
                accessibilityLabel={cat.label}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedInterest(cat.id)}
                className={`min-h-[44px] px-4 py-2.5 rounded-full border mr-2.5 flex-row items-center justify-center ${
                  isSelected
                    ? 'bg-signal-violet border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
                activeOpacity={0.7}
              >
                <Text className="mr-1.5 text-sm">
                  {CATEGORY_ICONS[cat.id] || '✨'}
                </Text>
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
          Activity Title *
        </Text>
        <TextInput
          accessibilityLabel="Activity Title Input"
          placeholder="e.g. 5-a-side Turf Football match"
          placeholderTextColor="#5A536B"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          className="border border-hairline bg-ink rounded-2xl px-4 py-3.5 text-moonlight font-body text-base mb-4 focus:border-signal-violet"
        />

        {/* Description Input */}
        <Text className="text-dusk font-body text-xs mb-1.5 uppercase font-semibold tracking-wider">
          Details & Description
        </Text>
        <TextInput
          accessibilityLabel="Details Input"
          placeholder="Need 2 more players. Casual, beginner friendly, bibs provided!"
          placeholderTextColor="#5A536B"
          multiline
          numberOfLines={3}
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          className="border border-hairline bg-ink rounded-2xl px-4 py-3 text-moonlight font-body text-base mb-4 h-24 focus:border-signal-violet"
        />

        {/* Activity Location & Venue */}
        <Text className="text-dusk font-body text-xs mb-2 uppercase font-semibold tracking-wider">
          Location & Meeting Spot *
        </Text>
        <View className="bg-ink border border-hairline rounded-3xl p-4 mb-5">
          {/* Search bar */}
          <View className="flex-row items-center mb-2.5">
            <TextInput
              accessibilityLabel="Search activity location"
              placeholder="Search a venue, park, or landmark"
              placeholderTextColor="#5A536B"
              value={locationSearch}
              onChangeText={setLocationSearch}
              maxLength={100}
              className="flex-1 border border-hairline bg-void rounded-2xl px-4 py-3 text-moonlight font-body text-base focus:border-signal-violet"
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Search venue location"
              onPress={searchForLocation}
              disabled={isSearchingLocation}
              className="ml-2 w-11 h-11 rounded-2xl bg-signal-violet items-center justify-center"
            >
              {isSearchingLocation ? <ActivityIndicator color="#F5F0FF" /> : <Search size={18} color="#F5F0FF" />}
            </TouchableOpacity>
          </View>

          {/* Use current location */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            onPress={useCurrentLocation}
            className="flex-row items-center min-h-[44px] py-1 mb-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <LocateFixed size={16} color="#C77DFF" />
            <Text className="text-pulse-lilac text-xs font-semibold ml-1.5">Use my current location</Text>
          </TouchableOpacity>

          {/* Map Preview */}
          <MapView
            accessibilityLabel="Selected activity location map"
            style={{ height: 135, borderRadius: 16, marginBottom: 10 }}
            provider={PROVIDER_DEFAULT}
            customMapStyle={darkMapStyle}
            region={{ ...selectedLocation, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={selectedLocation} title={selectedLocationLabel} />
          </MapView>

          {/* Selected Location Pill Badge */}
          <View className="flex-row items-center bg-void border border-hairline px-3.5 py-2.5 rounded-xl mb-3">
            <MapPin size={14} color="#C77DFF" />
            <Text className="text-moonlight text-xs font-semibold ml-2 flex-1" numberOfLines={1}>
              {selectedLocationLabel}
            </Text>
            <Text className="text-pulse-lilac font-mono text-2xs font-bold">
              {isLiveGps && !isCustomLocation ? 'Current GPS' : 'Selected Spot'}
            </Text>
          </View>

          {!isLiveGps && !isCustomLocation && !isLocationLoading && (
            <Text className="text-ember text-xs mb-3">{locationError || 'Location unavailable. Please search for a place above.'}</Text>
          )}

          {/* Optional exact venue spot label */}
          <TextInput
            accessibilityLabel="Venue label"
            placeholder="Specific spot (e.g. Court 3, South Gate) — optional"
            placeholderTextColor="#5A536B"
            value={venueName}
            onChangeText={setVenueName}
            maxLength={100}
            className="border border-hairline bg-void rounded-2xl px-4 py-3 text-moonlight font-body text-base focus:border-signal-violet"
          />
        </View>

        {/* Preferred gender */}
        <Text className="text-dusk font-body text-xs mb-2 uppercase font-semibold tracking-wider">Who Can Join?</Text>
        <View className="flex-row gap-2 mb-5">
          {[['any', 'Anyone'], ['male-only', 'Men only'], ['female-only', 'Women only']].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${label}`}
              accessibilityState={{ selected: filterGender === value }}
              onPress={() => setFilterGender(value as typeof filterGender)}
              className={`flex-1 min-h-[44px] py-2.5 rounded-2xl border items-center justify-center ${filterGender === value ? 'bg-signal-violet border-signal-violet' : 'bg-ink border-hairline'}`}
            >
              <Text className={`text-xs ${filterGender === value ? 'text-moonlight font-bold' : 'text-dusk'}`}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preferred age range */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider">
              Age Requirement
            </Text>
            <Text className="text-pulse-lilac font-mono text-xs font-bold">
              {isAnyAge
                ? 'All Ages (18+)'
                : `${ageRange[0]} – ${ageRange[1] >= 65 ? '65+' : ageRange[1]} yrs`}
            </Text>
          </View>

          {/* Mode Switch: Any Age vs Specific Ages */}
          <View className="flex-row gap-2 mb-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Allow all ages 18 and up"
              accessibilityState={{ selected: isAnyAge }}
              onPress={() => setIsAnyAge(true)}
              className={`flex-1 min-h-[44px] py-2.5 rounded-2xl border items-center justify-center ${
                isAnyAge
                  ? 'bg-signal-violet border-signal-violet'
                  : 'bg-ink border-hairline'
              }`}
            >
              <Text
                className={`text-xs ${
                  isAnyAge ? 'text-moonlight font-bold' : 'text-dusk'
                }`}
              >
                All Ages (18+)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Set specific age range"
              accessibilityState={{ selected: !isAnyAge }}
              onPress={() => setIsAnyAge(false)}
              className={`flex-1 min-h-[44px] py-2.5 rounded-2xl border items-center justify-center ${
                !isAnyAge
                  ? 'bg-signal-violet border-signal-violet'
                  : 'bg-ink border-hairline'
              }`}
            >
              <Text
                className={`text-xs ${
                  !isAnyAge ? 'text-moonlight font-bold' : 'text-dusk'
                }`}
              >
                Specific Ages
              </Text>
            </TouchableOpacity>
          </View>

          {/* Interactive Range Slider */}
          {!isAnyAge && (
            <View className="bg-ink border border-hairline px-4 py-3 rounded-2xl">
              <RangeSlider
                minValue={ageRange[0]}
                maxValue={ageRange[1]}
                min={18}
                max={65}
                step={1}
                minGap={1}
                onChange={(newMin, newMax) => setAgeRange([newMin, newMax])}
              />
              <View className="flex-row justify-between items-center mt-1">
                <Text className="text-dusk font-mono text-2xs">18 yrs</Text>
                <Text className="text-dusk font-mono text-2xs">65+ yrs</Text>
              </View>
            </View>
          )}
        </View>

        {/* Squad Capacity Slider */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider">
              Group Size
            </Text>
            <View className="flex-row items-center">
              <Users size={12} color="#C77DFF" />
              <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1">
                {maxParticipants} People Total
              </Text>
            </View>
          </View>

          <View className="bg-ink border border-hairline px-4 py-3 rounded-2xl">
            <StepSlider
              value={maxParticipants}
              min={2}
              max={20}
              step={1}
              accessibilityLabel="Group size slider"
              onChange={setMaxParticipants}
            />
            <View className="flex-row justify-between items-center mt-1">
              <Text className="text-dusk font-mono text-2xs">2 people</Text>
              <Text className="text-dusk font-mono text-2xs">20 people</Text>
            </View>
          </View>
        </View>

        {/* Broadcast Duration Picker */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider">
              Keep Post Active For
            </Text>
            <View className="flex-row items-center">
              <Clock size={12} color="#C77DFF" />
              <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1">
                {ttlHours} {ttlHours === 1 ? 'Hour' : 'Hours'}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {TTL_OPTIONS.map((hours) => {
              const isSelected = ttlHours === hours;
              return (
                <TouchableOpacity
                  key={hours}
                  accessibilityRole="button"
                  accessibilityLabel={`${hours} hours duration`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setTtlHours(hours)}
                  className={`flex-1 min-h-[44px] py-2.5 rounded-2xl border items-center justify-center ${
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

        {/* Privacy Notice */}
        <View className="bg-ink/60 border border-hairline/60 px-3.5 py-2.5 rounded-2xl mb-4 flex-row items-center">
          <ShieldCheck size={16} color="#C77DFF" />
          <Text className="text-dusk text-xs ml-2 flex-1 leading-snug">
            <Text className="text-pulse-lilac font-semibold">Location Privacy Active.</Text> Public map shows general area (~100m). Your exact meeting spot is only shared with approved members.
          </Text>
        </View>
      </ScrollView>

      {/* Pinned Docked Footer CTA */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        className="px-5 pt-3.5 bg-ink border-t border-hairline"
      >
        <TouchableOpacity
          testID="broadcast-live-squad"
          accessibilityRole="button"
          accessibilityLabel={`Post squad, active for ${ttlHours} hours`}
          onPress={handlePost}
          disabled={!title.trim() || isSubmitting}
          className={`w-full min-h-[52px] py-3.5 rounded-full items-center flex-row justify-center border ${
            title.trim() && !isSubmitting
              ? 'bg-signal-violet border-signal-violet-light/30'
              : 'bg-ink-raised border-hairline opacity-50'
          }`}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#F5F0FF" />
          ) : (
            <>
              <Sparkles size={16} color="#F5F0FF" style={{ marginRight: 8 }} />
              <Text className="text-moonlight font-display text-base font-bold">
                Post Squad (Active for {ttlHours}h)
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
