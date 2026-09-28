import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { interestEmoji } from '@hobbie/shared';
import { DiscoveryActivity } from '../../features/discovery/types';
import { useCountdown } from '../../hooks/useCountdown';

const HEAD_SIZE = 40;
const HEAD_RADIUS = HEAD_SIZE / 2;
const TAIL_WIDTH = 16;
const TAIL_HEIGHT = 18;
const TAIL_OVERLAP = 6;
const BADGE_GAP = 6;
const BADGE_HEIGHT = 22;

/** Vertical distance from the top of the marker view to the teardrop tip. */
const TAIL_TOP = HEAD_SIZE - TAIL_OVERLAP;
export const ACTIVITY_PIN_TIP_Y = TAIL_TOP + TAIL_HEIGHT;
const CONTAINER_HEIGHT = ACTIVITY_PIN_TIP_Y + BADGE_GAP + BADGE_HEIGHT;
const CONTAINER_WIDTH = 84;

/**
 * Anchor that pins the teardrop tip exactly onto the activity coordinate while
 * the TTL badge hangs below it.
 */
export const ACTIVITY_PIN_ANCHOR = {
  x: 0.5,
  y: ACTIVITY_PIN_TIP_Y / CONTAINER_HEIGHT,
};

interface ActivityPinProps {
  activity: DiscoveryActivity;
  isSelected?: boolean;
}

/**
 * Apple-Maps-style teardrop marker. Urgency drives the pin fill colour instead
 * of a pulsing ring, and the activity interest emoji is shown inside the head.
 */
export const ActivityPin = React.memo(function ActivityPin({
  activity,
  isSelected = false,
}: ActivityPinProps) {
  const { isExpired, formattedTtl, urgency, theme } = useCountdown(activity.expiresAt);
  const emoji = interestEmoji(activity.interestId);

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* Teardrop head carrying the activity emoji */}
      <View
        style={[
          styles.head,
          {
            backgroundColor: theme.primary,
            borderColor: isSelected ? '#F5F0FF' : 'rgba(245, 240, 255, 0.85)',
            borderWidth: isSelected ? 3 : 2,
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.emoji, isExpired && styles.emojiExpired]}
        >
          {emoji}
        </Text>
      </View>

      {/* Pointer tail that touches the exact coordinate */}
      <View style={[styles.tail, { borderTopColor: theme.primary }]} />

      {/* JetBrains Mono TTL Countdown Badge */}
      <View
        style={[
          styles.badge,
          {
            borderColor: isSelected ? '#F5F0FF' : theme.badgeBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            {
              color: theme.badgeText,
              fontWeight: urgency === 'expiring' ? '700' : '600',
            },
          ]}
        >
          {isExpired ? 'Expired' : formattedTtl}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  head: {
    width: HEAD_SIZE,
    height: HEAD_SIZE,
    borderRadius: HEAD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  emoji: {
    fontSize: 19,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  emojiExpired: {
    opacity: 0.5,
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -TAIL_OVERLAP,
    borderLeftWidth: TAIL_WIDTH / 2,
    borderRightWidth: TAIL_WIDTH / 2,
    borderTopWidth: TAIL_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  badge: {
    height: BADGE_HEIGHT,
    marginTop: BADGE_GAP,
    paddingHorizontal: 8,
    borderRadius: BADGE_HEIGHT / 2,
    borderWidth: 1,
    backgroundColor: 'rgba(23, 19, 31, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'JetBrains-Mono',
    letterSpacing: 0,
  },
});
