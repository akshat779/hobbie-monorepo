import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListFilter, Clock, MapPin, Users, ShieldCheck } from 'lucide-react-native';
import { useDiscoveryQuery } from '../../src/features/discovery/useDiscoveryQuery';
import { CategoryFilterBar } from '../../src/features/discovery/CategoryFilterBar';
import { DiscoveryEmptyState } from '../../src/features/discovery/DiscoveryEmptyState';
import { DevPersonaSwitcher } from '../../src/components/dev/DevPersonaSwitcher';
import { getPinTheme } from '../../src/features/discovery/utils';
import { useUserLocation } from '../../src/hooks/useUserLocation';

export default function DiscoveryListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { coords: userLocation, cityName, refreshLocation } = useUserLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const {
    data: activities = [],
    isLoading,
    isRefetching,
    refetch,
  } = useDiscoveryQuery({
    userLat: userLocation.latitude,
    userLng: userLocation.longitude,
    radiusKm: 4.5,
    category: selectedCategory,
  });

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5 pb-8"
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
          Live PostGIS feed within your 4.5km dynamic radar.
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
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refreshLocation();
              }}
              tintColor="#C77DFF"
              colors={['#C77DFF']}
            />
          }
          renderItem={({ item }) => {
            const theme = getPinTheme(item.ttlStatus.urgency);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/activity/${item.id}`)}
                className="bg-ink border border-hairline p-5 rounded-3xl mb-3"
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
                        <View className="bg-signal-violet/20 border border-signal-violet/50 px-1.5 py-0.5 rounded-full flex-row items-center mr-2">
                          <ShieldCheck size={9} color="#D2BBFF" />
                          <Text className="text-signal-violet-light text-[9.5px] font-bold ml-1">
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
                      <Clock size={11} color={theme.primary} />
                      <Text
                        style={{ color: theme.badgeText }}
                        className="font-mono text-xs font-bold ml-1"
                      >
                        {item.ttlStatus.formattedTtl}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-0.5">
                      <MapPin size={10} color="#A99BC2" />
                      <Text className="text-dusk font-mono text-[11px] ml-0.5">
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
                    <Text className="text-pulse-lilac text-[11px] font-semibold capitalize">
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
          }}
        />
      )}
    </View>
  );
}
