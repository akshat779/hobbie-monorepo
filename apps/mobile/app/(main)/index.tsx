import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  MapPin,
  Bell,
  Plus,
  RefreshCw,
  LocateFixed,
  SlidersHorizontal,
} from 'lucide-react-native';
import darkMapStyle from '../../src/theme/dark-map-style.json';
import { useDiscoveryQuery } from '../../src/features/discovery/useDiscoveryQuery';
import {
  DiscoveryActivity,
  selectedCategoryToInterestIds,
} from '../../src/features/discovery/types';
import { PulsePin } from '../../src/components/map/PulsePin';
import { UserLocationPin } from '../../src/components/map/UserLocationPin';
import { useShallow } from 'zustand/react/shallow';
import { CategoryFilterBar } from '../../src/features/discovery/CategoryFilterBar';
import { ActivityBottomSheet } from '../../src/features/discovery/ActivityBottomSheet';
import { useDiscoveryFiltersStore } from '../../src/features/discovery/useDiscoveryFiltersStore';
import { DiscoveryEmptyState } from '../../src/features/discovery/DiscoveryEmptyState';
import { DevPersonaSwitcher } from '../../src/components/dev/DevPersonaSwitcher';
import { useUserLocation } from '../../src/hooks/useUserLocation';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { subscribeToPostgresChanges } from '../../src/services/realtimePool';
import { queryKeys } from '../../src/services/queryKeys';

export default function DiscoveryMapScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const { coords: userLocation, cityName, refreshLocation } = useUserLocation();
  const authUser = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] =
    useState<DiscoveryActivity | null>(null);

  // One-time marker rasterization lock to prevent continuous 60fps bitmap allocation
  const [userPinTracking, setUserPinTracking] = useState(true);

  useEffect(() => {
    setUserPinTracking(true);
    const timer = setTimeout(() => {
      setUserPinTracking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [userLocation.latitude, userLocation.longitude]);

  const { filters, resetFilters } = useDiscoveryFiltersStore(
    useShallow((s) => ({
      filters: s.filters,
      resetFilters: s.resetFilters,
    }))
  );

  useEffect(() => {
    const unsubscribe = subscribeToPostgresChanges(
      'discovery_activities',
      { event: '*', schema: 'public', table: 'activities' },
      () => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discovery.all(),
        });
      },
      (message) => console.warn('Discovery Realtime error:', message),
    );
    return unsubscribe;
  }, [queryClient]);

  const interestIds = useMemo(
    () => selectedCategoryToInterestIds(selectedCategory),
    [selectedCategory]
  );

  const {
    data: activities = [],
    isLoading,
    isRefetching,
    refetch,
  } = useDiscoveryQuery(
    {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      radiusKm: filters.radiusKm,
      interestIds,
      enabled: Boolean(authUser) && !isAuthLoading,
    },
    { gender: filters.gender, ageGroup: filters.ageGroup }
  );

  const mapRegion = {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: Math.max(0.04, filters.radiusKm * 0.022),
    longitudeDelta: Math.max(0.04, filters.radiusKm * 0.022),
  };

  const hasActiveFilters =
    filters.radiusKm !== 4.5 ||
    filters.gender !== 'all' ||
    filters.ageGroup !== 'all';

  const handleSelectActivity = useCallback((activity: DiscoveryActivity) => {
    setSelectedActivity(activity);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedActivity(null);
  }, []);

  return (
    <View testID="discovery-map" className="flex-1 bg-void">
      {/* Interactive Nocturnal Map Canvas */}
      <View className="flex-1 relative">
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFill}
          customMapStyle={darkMapStyle}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsPointsOfInterests={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          onPress={handleCloseSheet}
        >
          {/* Dynamic Radius Boundary Ring based on Filter Radius */}
          <Circle
            center={userLocation}
            radius={filters.radiusKm * 1000}
            strokeColor="rgba(199, 125, 255, 0.45)"
            fillColor="rgba(123, 47, 247, 0.06)"
            strokeWidth={1.5}
          />

          {/* User Location Custom Radar Pulse Pin (Bounded Bitmap Rasterization) */}
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
            tracksViewChanges={userPinTracking}
          >
            <UserLocationPin />
          </Marker>

          {/* Live Squad Animated Pulse Pins (Zero Continuous Snapshotting) */}
          {activities.map((activity) => (
            <Marker
              key={activity.id}
              coordinate={{
                latitude: activity.fuzzedLocation.latitude,
                longitude: activity.fuzzedLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              tracksInfoWindowChanges={false}
              onPress={(e) => {
                e.stopPropagation();
                handleSelectActivity(activity);
              }}
            >
              <PulsePin
                activity={activity}
                isSelected={selectedActivity?.id === activity.id}
              />
            </Marker>
          ))}
        </MapView>

        {/* Floating Top Radar Header & Category Filter Bar */}
        <View
          style={{ paddingTop: Math.max(insets.top, 16) }}
          className="absolute top-0 left-0 right-0 z-40 px-4 pb-2 bg-void/85 backdrop-blur-md border-b border-hairline/40"
        >
          {/* Header Row: Location Pill + Filter Button + Sync + Notification */}
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              testID="host-squad-button"
              accessibilityRole="button"
              accessibilityLabel={`Discovery location ${cityName}, radius ${filters.radiusKm} kilometers`}
              onPress={() => router.push('/filters')}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className={`flex-row items-center min-h-[40px] px-4 py-2 rounded-full border ${
                hasActiveFilters
                  ? 'bg-signal-violet/20 border-signal-violet'
                  : 'bg-ink border-hairline'
              }`}
            >
              <MapPin size={14} color="#C77DFF" />
              <Text className="text-xs font-bold font-display text-moonlight ml-1.5">
                {cityName}
              </Text>
              <Text className="text-2xs font-mono text-dusk ml-1.5">
                • {filters.radiusKm}km
              </Text>
              {hasActiveFilters && (
                <View className="w-2 h-2 rounded-full bg-pulse-lilac ml-2" />
              )}
            </TouchableOpacity>

            <View className="flex-row items-center space-x-2">
              {/* Filter Modal Trigger */}
              <TouchableOpacity
                onPress={() => router.push('/filters')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Filter activities"
                className={`w-10 h-10 rounded-full border items-center justify-center mr-1.5 ${
                  hasActiveFilters
                    ? 'bg-signal-violet border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
                activeOpacity={0.7}
              >
                <SlidersHorizontal
                  size={15}
                  color={hasActiveFilters ? '#F5F0FF' : '#C77DFF'}
                />
              </TouchableOpacity>

              {/* Refresh Sync */}
              <TouchableOpacity
                onPress={() => {
                  refetch();
                  refreshLocation();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Refresh activities"
                className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center mr-1.5"
                activeOpacity={0.7}
              >
                <RefreshCw
                  size={15}
                  color={isRefetching ? '#C77DFF' : '#A99BC2'}
                />
              </TouchableOpacity>

              {/* Alerts Bell */}
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center"
                activeOpacity={0.7}
              >
                <Bell size={15} color="#F5F0FF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Horizontal Category Pill Bar */}
          <CategoryFilterBar
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedActivity(null);
            }}
          />
        </View>

        {/* Empty State Overlay when 0 squads match filter */}
        {!isLoading && activities.length === 0 && !selectedActivity && (
          <View className="absolute inset-0 z-30 justify-center items-center pointer-events-box-none px-4">
            <DiscoveryEmptyState
              category={selectedCategory}
              onResetFilter={() => {
                setSelectedCategory('all');
                resetFilters();
              }}
            />
          </View>
        )}

        {/* Floating Controls when no sheet is open: elevated above floating glass tab bar */}
        {!selectedActivity && (
          <View
            style={{ bottom: Math.max(insets.bottom, 12) + 76 }}
            className="absolute right-5 z-40 items-end pointer-events-box-none"
          >
            {/* Dev Persona Switcher FAB */}
            <DevPersonaSwitcher variant="fab" />

            {/* Floating Recenter Radar Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Center map on my location"
              onPress={() => {
                mapRef.current?.animateToRegion(mapRegion, 400);
                refreshLocation();
              }}
              className="w-11 h-11 rounded-full bg-ink/95 border border-hairline items-center justify-center mb-3 active:bg-ink-raised"
              activeOpacity={0.8}
            >
              <LocateFixed size={18} color="#C77DFF" />
            </TouchableOpacity>

            {/* Floating Action Button (Host Squad) */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Host Squad"
              onPress={() => router.push('/activity/create')}
              className="bg-signal-violet px-4 py-3.5 rounded-full flex-row items-center border border-signal-violet-light/30"
              activeOpacity={0.85}
            >
              <Plus size={18} color="#F5F0FF" />
              <Text className="text-moonlight font-display text-sm font-bold ml-1.5">
                Host Squad
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Interactive Activity Detail Bottom Sheet */}
      <ActivityBottomSheet
        activity={selectedActivity}
        onClose={handleCloseSheet}
        onRecenter={() => {
          mapRef.current?.animateToRegion(mapRegion, 400);
          refreshLocation();
        }}
      />
    </View>
  );
}
