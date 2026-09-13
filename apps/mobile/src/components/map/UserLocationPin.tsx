import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export function UserLocationPin() {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.8, 0.4, 0],
  });

  return (
    <View style={styles.container}>
      {/* Animated Radar Pulse Wave */}
      <Animated.View
        style={[
          styles.pulseWave,
          {
            transform: [{ scale: pulseScale }],
            opacity: pulseOpacity,
          },
        ]}
      />

      {/* Outer Halo */}
      <View style={styles.haloRing}>
        {/* Core Dot */}
        <View style={styles.coreDot} />
      </View>

      {/* "You" Pill Label */}
      <View style={styles.youBadge}>
        <Text style={styles.youText}>You</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseWave: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C77DFF',
  },
  haloRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(123, 47, 247, 0.35)',
    borderWidth: 2,
    borderColor: '#C77DFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 8px rgba(123, 47, 247, 0.8)',
  },
  coreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F5F0FF',
  },
  youBadge: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: 'rgba(23, 19, 31, 0.95)',
    borderColor: '#7B2FF7',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 9999,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.35)',
  },
  youText: {
    color: '#D2BBFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'JetBrainsMono_600SemiBold',
    letterSpacing: -0.2,
  },
});
