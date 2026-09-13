import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../features/auth/useAuthStore';
import {
  useLocationStore,
  UserCoordinates,
  DEFAULT_USER_LOCATION,
  DEFAULT_CITY_NAME,
} from '../features/location/useLocationStore';

export type { UserCoordinates };
export { DEFAULT_USER_LOCATION, DEFAULT_CITY_NAME };

export interface UserLocationState {
  coords: UserCoordinates;
  cityName: string;
  isLiveGps: boolean;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<void>;
}

/**
 * Hook consuming the shared Zustand location store.
 * Coordinates are acquired once and shared seamlessly across Map, List, and Create screens.
 */
export function useUserLocation(): UserLocationState {
  const userId = useAuthStore((s) => s.user?.id);

  const { coords, cityName, isLiveGps, isLoading, error, refreshLocation } =
    useLocationStore(
      useShallow((s) => ({
        coords: s.coords,
        cityName: s.cityName,
        isLiveGps: s.isLiveGps,
        isLoading: s.isLoading,
        error: s.error,
        refreshLocation: s.refreshLocation,
      }))
    );

  const handleRefresh = useCallback(async () => {
    await refreshLocation(userId);
  }, [refreshLocation, userId]);

  useEffect(() => {
    // Acquire location once if not already live
    if (!isLiveGps && !isLoading) {
      handleRefresh();
    }
  }, [isLiveGps, isLoading, handleRefresh]);

  return {
    coords,
    cityName,
    isLiveGps,
    isLoading,
    error,
    refreshLocation: handleRefresh,
  };
}
