import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListFilter, Clock, MapPin, Users, ShieldCheck } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useDiscoveryQuery } from '../../src/features/discovery/useDiscoveryQuery';
import { useDiscoveryFiltersStore } from '../../src/features/discovery/useDiscoveryFiltersStore';
import { CategoryFilterBar } from '../../src/features/discovery/CategoryFilterBar';
import { DiscoveryEmptyState } from '../../src/features/discovery/DiscoveryEmptyState';
import { DevPersonaSwitcher } from '../../src/components/dev/DevPersonaSwitcher';
import { useUserLocation } from '../../src/hooks/useUserLocation';
import { useRefreshByUser } from '../../src/hooks/useRefreshByUser';
import { useCountdown } from '../../src/hooks/useCountdown';
import { NearbyActivity } from '../../src/features/discovery/types';

function SquadFeedCard({
  item,
  onPress,
}: {
  item: NearbyActivity;
  onPress: () => void;
}) {
  const { isExpired, formattedTtl, theme } = useCountdown(item.expiresAt);

  return (
    <TouchableOpacity
      testID={`squad-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Squad ${item.title}`}
      onPress={onPress}
      className={`bg-ink border border-hairline p-5 rounded-3xl mb-3 ${
        isExpired ? 'opacity-60' : ''
      }`}
      activeOpacity={0.75}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-moonlight font-display text-base font-bold">
            {item.title}
          </Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-dusk text-xs mr-2">
              Host: {item.hostName}
            </Text>
            {item.hostIsVerified && (
              <View className="bg-signal-violet/20 border border-signal-violet/50 px-2 py-0.5 rounded-full flex-row items-center mr-2">
                <ShieldCheck size={11} color="#D2BBFF" />
                <Text className="text-signal-violet-light text-2xs font-bold ml-1">
                  Verified
                </Text>
              </View>
            )}
            <Text className="text-pulse-lilac font-mono text-xs font-bold">
              ★ {item.hostTrustScore.toFixed(2)}
            </Text>
          </View>
        </View>

        <View className="items-end">
          <View className="flex-row items-center">
            <Clock size={11} color={isExpired ? '#5A536B' : theme.primary} />
            <Text
              style={{ color: isExpired ? '#A99BC2' : theme.badgeText }}
              className="font-mono text-xs font-bold ml-1"
            >
              {isExpired ? 'Expired' : formattedTtl}
            </Text>
          </View>
          <View className="flex-row items-center mt-0.5">
            <MapPin size={10} color="#A99BC2" />
            <Text className="text-dusk font-mono text-2xs ml-0.5">
              {item.distanceKm} km
            </Text>
          </View>
        </View>
      </View>

      {item.description ? (
        <Text
          numberOfLines={2}
          className="text-dusk text-xs mb-3 leading-relaxed"
        >
          {item.description}
        </Text>
      ) : null}

      <View className="flex-row items-center justify-between pt-3 border-t border-hairline/60">
        <View className="px-2.5 py-1 rounded-full bg-void border border-hairline">
          <Text className="text-pulse-lilac text-2xs font-semibold capitalize">
            {item.interestId.replace('_', ' ')}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Users size={12} color="#A99BC2" />
          <Text className="text-dusk text-xs font-mono ml-1">
            {item.currentParticipantsCount}/{item.maxParticipants} spots
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoveryListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coords: userLocation, cityName, refreshLocation } = useUserLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filters = useDiscoveryFiltersStore(useShallow((s) => s.filters));

  const {
    data: activities = [],
    isLoading,
    refetch,
  } = useDiscoveryQuery({
    userLat: userLocation.latitude,
    userLng: userLocation.longitude,
    radiusKm: filters.radiusKm,
    category: selectedCategory,
    gender: filters.gender,
    ageGroup: filters.ageGroup,
  });

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(
    useCallback(async () => {
      await Promise.all([refetch(), refreshLocation()]);
    }, [refetch, refreshLocation])
  );

  return (
    <View
      testID="discovery-feed"
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5"
    >
      <DevPersonaSwitcher variant="pill" />

      {/* Header */}
      <View className="mb-3 pr-24">
        <View className="flex-row items-center mb-1">
          <ListFilter size={18} color="#C77DFF" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac ml-1.5">
            Nearby Feed
          </Text>
        </View>
        <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
          Active Squads
        </Text>
        <Text className="text-xs text-dusk">
          Live PostGIS feed within your {filters.radiusKm}km dynamic radar.
        </Text>
      </View>

      {/* Horizontal Category Filter Bar */}
      <View className="mb-4">
        <CategoryFilterBar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </View>

      {/* Activities List */}
      {!isLoading && activities.length === 0 ? (
        <DiscoveryEmptyState
          category={selectedCategory}
          onResetFilter={() => setSelectedCategory('all')}
        />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingByUser}
              onRefresh={refetchByUser}
              tintColor="#C77DFF"
              colors={['#C77DFF']}
            />
          }
          renderItem={({ item }) => (
            <SquadFeedCard
              item={item}
              onPress={() => router.push(`/activity/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
