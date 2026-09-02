import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
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
  DiscoveryFiltersState,
  NearbyActivity,
} from '../../src/features/discovery/types';
import { PulsePin } from '../../src/components/map/PulsePin';
import { UserLocationPin } from '../../src/components/map/UserLocationPin';
import { CategoryFilterBar } from '../../src/features/discovery/CategoryFilterBar';
import { ActivityBottomSheet } from '../../src/features/discovery/ActivityBottomSheet';
import { DiscoveryFilterModal } from '../../src/features/discovery/DiscoveryFilterModal';
import { DiscoveryEmptyState } from '../../src/features/discovery/DiscoveryEmptyState';
import { DevPersonaSwitcher } from '../../src/components/dev/DevPersonaSwitcher';
import { useUserLocation } from '../../src/hooks/useUserLocation';

export default function DiscoveryMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const { coords: userLocation, cityName, refreshLocation } = useUserLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] =
    useState<NearbyActivity | null>(null);

  // One-time marker rasterization lock to prevent continuous 60fps bitmap allocation
  const [userPinTracking, setUserPinTracking] = useState(true);

  useEffect(() => {
    setUserPinTracking(true);
    const timer = setTimeout(() => {
      setUserPinTracking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [userLocation.latitude, userLocation.longitude]);

  const [filters, setFilters] = useState<DiscoveryFiltersState>({
    radiusKm: 4.5,
    gender: 'all',
    ageGroup: 'all',
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const {
    data: activities = [],
    isLoading,
    isRefetching,
    refetch,
  } = useDiscoveryQuery({
    userLat: userLocation.latitude,
    userLng: userLocation.longitude,
    radiusKm: filters.radiusKm,
    category: selectedCategory,
    gender: filters.gender,
    ageGroup: filters.ageGroup,
  });

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

  const handleSelectActivity = useCallback((activity: NearbyActivity) => {
    setSelectedActivity(activity);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedActivity(null);
  }, []);

  return (
    <View className="flex-1 bg-void">
      {/* Dev Persona Switcher Floating Quick Switch */}
      <DevPersonaSwitcher />

      {/* Interactive Nocturnal Map Canvas */}
      <View className="flex-1 relative">
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={StyleSheet.absoluteFillObject}
          customMapStyle={darkMapStyle}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsPointsOfInterest={false}
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
                latitude: activity.lat,
                longitude: activity.lng,
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
          <View className="flex-row items-center justify-between mb-3 pr-28">
            <TouchableOpacity
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.8}
              className={`flex-row items-center px-3.5 py-1.5 rounded-full border ${
                hasActiveFilters
                  ? 'bg-signal-violet/20 border-signal-violet'
                  : 'bg-ink border-hairline'
              }`}
            >
              <MapPin size={13} color="#C77DFF" />
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
                onPress={() => setFilterModalVisible(true)}
                className={`w-8 h-8 rounded-full border items-center justify-center mr-1.5 ${
                  hasActiveFilters
                    ? 'bg-signal-violet border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
                activeOpacity={0.7}
              >
                <SlidersHorizontal
                  size={13}
                  color={hasActiveFilters ? '#F5F0FF' : '#C77DFF'}
                />
              </TouchableOpacity>

              {/* Refresh Sync */}
              <TouchableOpacity
                onPress={() => {
                  refetch();
                  refreshLocation();
                }}
                className="w-8 h-8 rounded-full bg-ink border border-hairline items-center justify-center mr-1.5"
                activeOpacity={0.7}
              >
                <RefreshCw
                  size={13}
                  color={isRefetching ? '#C77DFF' : '#A99BC2'}
                />
              </TouchableOpacity>

              {/* Alerts Bell */}
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-ink border border-hairline items-center justify-center"
                activeOpacity={0.7}
              >
                <Bell size={13} color="#F5F0FF" />
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
                setFilters({ radiusKm: 4.5, gender: 'all', ageGroup: 'all' });
              }}
            />
          </View>
        )}

        {/* Floating Recenter Radar Button */}
        <TouchableOpacity
          onPress={() => {
            mapRef.current?.animateToRegion(mapRegion, 400);
            refreshLocation();
          }}
          style={{ bottom: selectedActivity ? 310 : 80 }}
          className="absolute right-5 z-40 w-11 h-11 rounded-full bg-ink/95 border border-hairline items-center justify-center shadow-xl active:bg-ink-raised"
          activeOpacity={0.8}
        >
          <LocateFixed size={18} color="#C77DFF" />
        </TouchableOpacity>

        {/* Floating Action Button (Host Squad) */}
        <TouchableOpacity
          onPress={() => router.push('/activity/create')}
          style={{ bottom: selectedActivity ? 254 : 24 }}
          className="absolute right-5 z-40 bg-signal-violet px-4 py-3.5 rounded-full flex-row items-center shadow-2xl border border-signal-violet-light/30"
          activeOpacity={0.85}
        >
          <Plus size={18} color="#F5F0FF" />
          <Text className="text-moonlight font-display text-sm font-bold ml-1.5">
            Host Squad
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Activity Detail Bottom Sheet */}
      {selectedActivity && (
        <View
          style={{ elevation: 30 }}
          className="absolute bottom-0 left-0 right-0 z-50"
        >
          <ActivityBottomSheet
            activity={selectedActivity}
            onClose={handleCloseSheet}
          />
        </View>
      )}

      {/* Multi-Facet Discovery Filter Modal */}
      <DiscoveryFilterModal
        visible={filterModalVisible}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          setSelectedActivity(null);
        }}
        onClose={() => setFilterModalVisible(false)}
        totalSquadsCount={activities.length}
      />
    </View>
  );
}
