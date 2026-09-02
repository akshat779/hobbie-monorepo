import { InterestId } from '@hobbie/shared';

export type TtlUrgency = 'fresh' | 'moderate' | 'expiring' | 'expired';

export interface TtlStatus {
  minutesLeft: number;
  formattedTtl: string;
  urgency: TtlUrgency;
}

export interface HostProfile {
  id: string;
  name: string;
  trustScore: number;
  isVerified: boolean;
  avatarUrl?: string | null;
}

export type GenderFilterOption = 'all' | 'men_only' | 'women_only' | 'coed';
export type AgeGroupOption = 'all' | '18_24' | '25_34' | '35_plus';

export interface DiscoveryFiltersState {
  radiusKm: number;
  gender: GenderFilterOption;
  ageGroup: AgeGroupOption;
}

export interface NearbyActivity {
  id: string;
  hostId: string;
  hostName: string;
  hostTrustScore: number;
  hostIsVerified: boolean;
  hostAvatarUrl?: string | null;
  interestId: InterestId | string;
  title: string;
  description: string;
  tier: 'physical' | 'virtual' | string;
  lat: number;
  lng: number;
  venueName?: string | null;
  expiresAt: string;
  maxParticipants: number;
  currentParticipantsCount: number;
  distanceMeters: number;
  distanceKm: number;
  ttlStatus: TtlStatus;
  filterGender?: GenderFilterOption | string | null;
  filterAgeMin?: number | null;
  filterAgeMax?: number | null;
}

export interface DiscoveryQueryParams {
  userLat: number;
  userLng: number;
  radiusKm?: number;
  category?: string;
  gender?: GenderFilterOption;
  ageGroup?: AgeGroupOption;
}
