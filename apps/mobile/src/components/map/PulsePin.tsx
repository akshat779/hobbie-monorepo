import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { NearbyActivity } from '../../features/discovery/types';
import { useCountdown } from '../../hooks/useCountdown';

interface PulsePinProps {
  activity: NearbyActivity;
  isSelected?: boolean;
  onPress?: () => void;
}

export const PulsePin = React.memo(function PulsePin({
  activity,
  isSelected = false,
}: PulsePinProps) {
  const { isExpired, formattedTtl, urgency, theme } = useCountdown(activity.expiresAt);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (theme.pulseSpeedMs > 0 && !isExpired) {
      const loopAnimation = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: theme.pulseSpeedMs,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      loopAnimation.start();

      return () => loopAnimation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [theme.pulseSpeedMs, isExpired, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.85],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.65, 0.45, 0],
  });

  return (
    <View pointerEvents="none" style={styles.container}>
      {/* Animated Pulse Ring (Native Driver Safe) */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: theme.primary,
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* Main Circular Pin Surface */}
      <View
        style={[
          styles.pinBody,
          {
            borderColor: isSelected ? '#F5F0FF' : theme.primary,
            backgroundColor: theme.bg,
            borderWidth: isSelected ? 2.5 : 2,
            transform: [{ scale: isSelected ? 1.15 : 1 }],
          },
        ]}
      >
        {/* Inner Glowing Center Core */}
        <View
          style={[
            styles.pinCore,
            { backgroundColor: theme.primary },
          ]}
        />
      </View>

      {/* JetBrains Mono TTL Countdown Badge */}
      <View
        style={[
          styles.ttlBadge,
          {
            borderColor: isSelected ? '#F5F0FF' : theme.badgeBorder,
            backgroundColor: 'rgba(23, 19, 31, 0.95)',
          },
        ]}
      >
        <Text
          style={[
            styles.ttlText,
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
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pinBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  ttlBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  ttlText: {
    fontSize: 12,
    fontFamily: 'JetBrains-Mono',
    letterSpacing: 0,
  },
});
