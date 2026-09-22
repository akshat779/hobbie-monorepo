import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  PanResponder,
  GestureResponderEvent,
  StyleSheet,
  LayoutChangeEvent,
  AccessibilityActionEvent,
  Animated,
} from 'react-native';

interface StepSliderProps {
  value: number;
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  accessibilityLabel?: string;
}

export function StepSlider({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  min,
  max,
  step = 1,
  accessibilityLabel = 'Stepped slider',
}: StepSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageX = useRef(0);
  const trackRef = useRef<View>(null);
  const isDragging = useRef(false);
  const lastEmittedValue = useRef(value);

  const initialRatio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const animRatio = useRef(new Animated.Value(initialRatio)).current;
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!isDragging.current) {
      lastEmittedValue.current = value;
      setDisplayValue(value);
      const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
      animRatio.setValue(ratio);
    }
  }, [value, min, max, animRatio]);

  const measureAndStore = () => {
    trackRef.current?.measureInWindow((pageX, _y, width) => {
      if (width > 0) {
        trackWidthRef.current = width;
        trackPageX.current = pageX;
        setTrackWidth(width);
      }
    });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      trackWidthRef.current = width;
      setTrackWidth(width);
      measureAndStore();
    }
  };

  const updateFromPageX = (pageX: number) => {
    const currentTrackWidth = trackWidthRef.current;
    if (currentTrackWidth <= 0) return;
    const x = pageX - trackPageX.current;
    const ratio = Math.max(0, Math.min(1, x / currentTrackWidth));

    const rawVal = min + ratio * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));

    const clampedRatio = Math.max(0, Math.min(1, (clamped - min) / (max - min)));
    animRatio.setValue(clampedRatio);

    if (clamped !== lastEmittedValue.current) {
      lastEmittedValue.current = clamped;
      setDisplayValue(clamped);
      onChange(clamped);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        isDragging.current = true;
        onSlidingStart?.();
        trackRef.current?.measureInWindow((pageX, _y, width) => {
          if (width > 0) {
            trackWidthRef.current = width;
            trackPageX.current = pageX;
            setTrackWidth(width);
          }
          updateFromPageX(evt.nativeEvent.pageX);
        });
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (isDragging.current) {
          updateFromPageX(evt.nativeEvent.pageX);
        }
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        onSlidingComplete?.(lastEmittedValue.current);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        onSlidingComplete?.(lastEmittedValue.current);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      const next = Math.min(max, value + step);
      onChange(next);
    } else if (event.nativeEvent.actionName === 'decrement') {
      const prev = Math.max(min, value - step);
      onChange(prev);
    }
  };

  const targetWidth = trackWidth > 0 ? trackWidth : 280;

  const activeTrackWidth = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetWidth],
  });

  const thumbTranslateX = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetWidth],
  });

  return (
    <View style={styles.sliderContainer}>
      <View
        ref={trackRef}
        onLayout={handleLayout}
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min,
          max,
          now: displayValue,
          text: `${displayValue}`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increment value' },
          { name: 'decrement', label: 'Decrement value' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        {...panResponder.panHandlers}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.touchContainer}
      >
        {/* Inactive Rail */}
        <View style={styles.trackRail} />

        {/* Active Filled Bar */}
        <Animated.View
          style={[
            styles.trackFilled,
            { width: activeTrackWidth },
          ]}
        />

        {/* Minimalist Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: thumbTranslateX }] },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sliderContainer: {
    width: '100%',
    paddingTop: 2,
  },
  touchContainer: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  trackRail: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2C2739',
    width: '100%',
  },
  trackFilled: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#7B2FF7',
    left: 0,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F0FF',
    borderColor: '#7B2FF7',
    borderWidth: 2.5,
    marginLeft: -12,
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.4)',
  },
});
