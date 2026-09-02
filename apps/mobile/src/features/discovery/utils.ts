import { TtlStatus, TtlUrgency } from './types';

/**
 * Calculates remaining TTL and determines the urgency status
 * for dynamic Nocturnal Pulse indicators.
 */
export function getTtlStatus(
  expiresAt: string | Date,
  now: Date = new Date()
): TtlStatus {
  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const diffMs = expiryDate.getTime() - now.getTime();
  const minutesLeft = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  if (diffMs <= 0 || minutesLeft <= 0) {
    return {
      minutesLeft: 0,
      formattedTtl: 'Expired',
      urgency: 'expired',
    };
  }

  let urgency: TtlUrgency = 'fresh';
  if (minutesLeft < 30) {
    urgency = 'expiring';
  } else if (minutesLeft <= 60) {
    urgency = 'moderate';
  } else {
    urgency = 'fresh';
  }

  const hours = Math.floor(minutesLeft / 60);
  const remainingMinutes = minutesLeft % 60;

  let formattedTtl = '';
  if (hours > 0) {
    formattedTtl =
      remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else {
    formattedTtl = `${minutesLeft}m`;
  }

  return {
    minutesLeft,
    formattedTtl,
    urgency,
  };
}

export interface PinTheme {
  primary: string;
  secondary: string;
  ringGlow: string;
  bg: string;
  badgeBorder: string;
  badgeText: string;
  pulseSpeedMs: number;
}

/**
 * Returns color tokens and pulse speeds adhering to the Nocturnal Pulse design system.
 */
export function getPinTheme(urgency: TtlUrgency): PinTheme {
  switch (urgency) {
    case 'expiring':
      return {
        primary: '#FF6B5E', // ember
        secondary: '#FF8A7A',
        ringGlow: 'rgba(255, 107, 94, 0.5)',
        bg: '#211015',
        badgeBorder: '#FF6B5E',
        badgeText: '#FF6B5E',
        pulseSpeedMs: 1000,
      };
    case 'moderate':
      return {
        primary: '#7B2FF7', // signal-violet
        secondary: '#9D5CFF',
        ringGlow: 'rgba(123, 47, 247, 0.3)',
        bg: '#17131F',
        badgeBorder: '#7B2FF7',
        badgeText: '#D2BBFF',
        pulseSpeedMs: 2000,
      };
    case 'fresh':
      return {
        primary: '#C77DFF', // pulse-lilac
        secondary: '#7B2FF7', // signal-violet
        ringGlow: 'rgba(199, 125, 255, 0.4)',
        bg: '#17131F',
        badgeBorder: '#C77DFF',
        badgeText: '#C77DFF',
        pulseSpeedMs: 2400,
      };
    case 'expired':
    default:
      return {
        primary: '#5A536B',
        secondary: '#3B3449',
        ringGlow: 'transparent',
        bg: '#17131F',
        badgeBorder: '#2C2739',
        badgeText: '#A99BC2',
        pulseSpeedMs: 0,
      };
  }
}

/**
 * Formats distance cleanly in meters or kilometers.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Haversine formula to compute great-circle distance between two points in km.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
