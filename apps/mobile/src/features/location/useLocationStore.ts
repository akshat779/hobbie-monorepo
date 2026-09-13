import { create } from 'zustand';
import * as Location from 'expo-location';
import { supabase } from '../../services/supabase';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationState {
  coords: UserCoordinates;
  cityName: string;
  isLiveGps: boolean;
  isLoading: boolean;
  error: string | null;
  refreshLocation: (userId?: string) => Promise<void>;
}

export const DEFAULT_USER_LOCATION: UserCoordinates = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export const DEFAULT_CITY_NAME = 'Koramangala, BLR';

/**
 * Shared Zustand 5 store for device GPS coordinates & reverse geocoded city name.
 * Prevents multiple screens from independently polling the device GPS hardware.
 */
export const useLocationStore = create<LocationState>((set, get) => ({
  coords: DEFAULT_USER_LOCATION,
  cityName: DEFAULT_CITY_NAME,
  isLiveGps: false,
  isLoading: false,
  error: null,

  refreshLocation: async (userId?: string) => {
    if (get().isLoading) return;

    try {
      set({ isLoading: true, error: null });

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({
          error: 'Location permission not granted. Using default zone.',
          isLoading: false,
        });
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userCoords: UserCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      let resolvedCity = get().cityName;
      try {
        const reverse = await Location.reverseGeocodeAsync(userCoords);
        if (reverse && reverse.length > 0) {
          const place = reverse[0];
          const area =
            place?.district || place?.subregion || place?.name || place?.city;
          const city = place?.city || place?.region || '';
          if (area && city) {
            resolvedCity = `${area}, ${city}`;
          } else if (area || city) {
            resolvedCity = area || city || DEFAULT_CITY_NAME;
          }
        }
      } catch {
        // Keep previous or default city label
      }

      set({
        coords: userCoords,
        cityName: resolvedCity,
        isLiveGps: true,
        isLoading: false,
        error: null,
      });

      // Non-blocking background sync coarse location to Supabase profile
      if (userId) {
        try {
          await supabase.rpc('update_user_location', {
            p_user_id: userId,
            p_lat: userCoords.latitude,
            p_lng: userCoords.longitude,
            p_geohash: `${userCoords.latitude.toFixed(3)},${userCoords.longitude.toFixed(3)}`,
          });
        } catch {
          // Silent ignore background sync failure
        }
      }
    } catch (err: any) {
      console.warn('Location resolution warning:', err?.message);
      set({
        error: err?.message || 'Failed to acquire device GPS',
        isLoading: false,
      });
    }
  },
}));
