import * as Location from 'expo-location';
import { Coordinates, CoordinatesSchema } from '@hobbie/shared';

export interface SelectedLocation {
  coordinates: Coordinates;
  label: string;
}

export async function searchLocation(query: string): Promise<SelectedLocation> {
  const normalized = query.trim();
  if (!normalized) throw new Error('Enter a venue, address, or landmark');
  const matches = await Location.geocodeAsync(normalized);
  const first = matches[0];
  if (!first || typeof first.latitude !== 'number' || typeof first.longitude !== 'number') {
    throw new Error('No location found. Try a venue name, address, or landmark.');
  }
  const coordinates = CoordinatesSchema.parse({ latitude: first.latitude, longitude: first.longitude });
  return { coordinates, label: normalized };
}
