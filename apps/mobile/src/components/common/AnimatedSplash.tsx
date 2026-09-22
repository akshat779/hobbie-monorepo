import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { HobbieLogo } from './HobbieLogo';
import { PALETTE } from '../../theme/colors';

const NATIVE_SPLASH_IMAGE_WIDTH = 200;
const WORDMARK_WIDTH_RATIO = 0.918;
const SPLASH_LOGO_WIDTH = Math.round(NATIVE_SPLASH_IMAGE_WIDTH * WORDMARK_WIDTH_RATIO);

const LOGO_FADE_IN_MS = 420;
const LOGO_SETTLE_MS = 560;
const HOLD_MS = 300;
const OVERLAY_FADE_OUT_MS = 300;

export interface AnimatedSplashProps {
  ready: boolean;
  onFinish: () => void;
}

export function AnimatedSplash({ ready, onFinish }: AnimatedSplashProps) {
  const [laidOut, setLaidOut] = useState(false);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.94)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  const handleLayout = useCallback(() => setLaidOut(true), []);

  useEffect(() => {
    if (!laidOut || !ready) {
      return;
    }

    let cancelled = false;

    const handoff = Animated.delay(LOGO_SETTLE_MS);
    handoff.start(() => {
      if (!cancelled) {
        void SplashScreen.hideAsync();
      }
    });

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: LOGO_FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: LOGO_SETTLE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: OVERLAY_FADE_OUT_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished && !cancelled) {
        onFinish();
      }
    });

    return () => {
      cancelled = true;
      handoff.stop();
      sequence.stop();
    };
  }, [laidOut, ready, logoOpacity, logoScale, overlayOpacity, onFinish]);

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayOpacity }]}
    >
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <HobbieLogo variant="light" width={SPLASH_LOGO_WIDTH} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.void,
  },
});
