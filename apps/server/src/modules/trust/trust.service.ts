import { TRUST_CONFIG } from '@hobbie/shared';

export interface RatingEntry {
  score: number; // 1 to 5
  createdAt: Date;
}

/**
 * Calculates rolling average trust score over the last N ratings.
 * Prevents brigading attacks from permanently tanking users.
 */
export function calculateRollingTrustScore(
  ratings: RatingEntry[],
  windowSize: number = TRUST_CONFIG.ROLLING_WINDOW_SIZE
): { trustScore: number; sampleSize: number; isLimited: boolean } {
  if (!ratings || ratings.length === 0) {
    return {
      trustScore: TRUST_CONFIG.DEFAULT_INITIAL_SCORE,
      sampleSize: 0,
      isLimited: false,
    };
  }

  // Sort descending by date to take the most recent N interactions
  const sorted = [...ratings].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  const recentSlice = sorted.slice(0, windowSize);

  const sum = recentSlice.reduce((acc, curr) => acc + curr.score, 0);
  const average = Math.round((sum / recentSlice.length) * 10) / 10;

  const isLimited =
    recentSlice.length >= 3 &&
    average < TRUST_CONFIG.AUTO_LIMIT_VISIBILITY_THRESHOLD;

  return {
    trustScore: average,
    sampleSize: recentSlice.length,
    isLimited,
  };
}
