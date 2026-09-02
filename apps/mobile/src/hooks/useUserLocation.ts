import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../features/auth/useAuthStore';

export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

export interface UserLocationState {
  coords: UserCoordinates;
  cityName: string;
  isLiveGps: boolean;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<void>;
}

// Default epicenter: Bangalore Tech Park / Koramangala (matches DB seed data)
export const DEFAULT_USER_LOCATION: UserCoordinates = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export const DEFAULT_CITY_NAME = 'Koramangala, BLR';

export function useUserLocation(): UserLocationState {
  const { user } = useAuthStore();
  const [coords, setCoords] = useState<UserCoordinates>(DEFAULT_USER_LOCATION);
  const [cityName, setCityName] = useState<string>(DEFAULT_CITY_NAME);
  const [isLiveGps, setIsLiveGps] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Fallback to default Bangalore epicenter
        setError('Location permission not granted. Using default zone.');
        setIsLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userCoords: UserCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setCoords(userCoords);
      setIsLiveGps(true);

      // Reverse geocode to get a clean neighborhood/city label
      try {
        const reverse = await Location.reverseGeocodeAsync(userCoords);
        if (reverse && reverse.length > 0) {
          const place = reverse[0];
          const area = place?.district || place?.subregion || place?.name || place?.city;
          const city = place?.city || place?.region || '';
          if (area && city) {
            setCityName(`${area}, ${city}`);
          } else if (area || city) {
            setCityName(area || city || DEFAULT_CITY_NAME);
          }
        }
      } catch {
        // Keep previous or default city label
      }

      // Sync coarse location to Supabase profile in background if logged in
      if (user?.id) {
        try {
          await supabase.rpc('update_user_location', {
            p_user_id: user.id,
            p_lat: userCoords.latitude,
            p_lng: userCoords.longitude,
            p_geohash: `${userCoords.latitude.toFixed(3)},${userCoords.longitude.toFixed(3)}`,
          });
        } catch {
          // Non-blocking background sync
        }
      }
    } catch (err: any) {
      console.warn('Location resolution warning:', err?.message);
      setError(err?.message || 'Failed to acquire device GPS');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLiveLocation();
  }, [fetchLiveLocation]);

  return {
    coords,
    cityName,
    isLiveGps,
    isLoading,
    error,
    refreshLocation: fetchLiveLocation,
  };
}
