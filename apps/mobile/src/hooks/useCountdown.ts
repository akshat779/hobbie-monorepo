import { useState, useEffect, useMemo } from 'react';
import { TtlStatus, TtlUrgency } from '../features/discovery/types';
import { getPinTheme, PinTheme } from '../features/discovery/utils';

export interface CountdownResult extends TtlStatus {
  isExpired: boolean;
  theme: PinTheme;
}

/**
 * Pure calculation for TTL countdown and urgency state.
 * Guaranteed deterministic for unit testing.
 */
export function calculateLiveTtl(
  expiresAt: string | Date | null | undefined,
  nowMs: number = Date.now()
): CountdownResult {
  if (!expiresAt) {
    return {
      minutesLeft: 0,
      formattedTtl: 'No Expiry',
      urgency: 'expired',
      isExpired: true,
      theme: getPinTheme('expired'),
    };
  }

  const expiryMs = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
  const diffMs = expiryMs - nowMs;
  const minutesLeft = Math.floor(diffMs / (1000 * 60));

  if (diffMs <= 0 || minutesLeft <= 0) {
    return {
      minutesLeft: 0,
      formattedTtl: 'Expired',
      urgency: 'expired',
      isExpired: true,
      theme: getPinTheme('expired'),
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
    isExpired: false,
    theme: getPinTheme(urgency),
  };
}

/**
 * Reactive countdown hook that updates every `intervalMs` (default: 10 seconds).
 * Automatically cleans up timer on unmount to prevent memory leaks.
 */
export function useCountdown(
  expiresAt: string | Date | null | undefined,
  intervalMs: number = 10_000
): CountdownResult {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;

    // Check if already expired to avoid unnecessary intervals
    const initialExpiryMs =
      typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
    if (initialExpiryMs <= Date.now()) return;

    const timer = setInterval(() => {
      const currentNow = Date.now();
      if (initialExpiryMs <= currentNow) {
        setNow(currentNow);
        clearInterval(timer);
        return;
      }

      setNow((prev) => {
        const prevMinutes = Math.max(0, Math.floor((initialExpiryMs - prev) / 60000));
        const nextMinutes = Math.max(0, Math.floor((initialExpiryMs - currentNow) / 60000));
        return prevMinutes !== nextMinutes ? currentNow : prev;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [expiresAt, intervalMs]);

  return useMemo(() => calculateLiveTtl(expiresAt, now), [expiresAt, now]);
}
