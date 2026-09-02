import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  StyleSheet,
  LayoutChangeEvent,
  AccessibilityActionEvent,
  Animated,
} from 'react-native';

interface RadiusSliderProps {
  value: number;
  onChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function RadiusSlider({
  value,
  onChange,
  onSlidingStart,
  onSlidingComplete,
  min = 1,
  max = 50,
  step = 0.5,
}: RadiusSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
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
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (width > 0) {
        setTrackWidth(width);
        trackPageX.current = pageX;
      }
    });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0) {
      setTrackWidth(width);
      measureAndStore();
    }
  };

  const updateFromPageX = (pageX: number) => {
    if (trackWidth <= 0) return;
    const x = pageX - trackPageX.current;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));

    // 1. Instant 60fps/120fps hardware animated value
    animRatio.setValue(ratio);

    // 2. Compute stepped value
    const rawVal = min + ratio * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, Math.round(stepped * 10) / 10));

    if (clamped !== lastEmittedValue.current) {
      lastEmittedValue.current = clamped;
      setDisplayValue(clamped);
      onChange(clamped);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4;
      },
      onMoveShouldSetPanResponderCapture: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4;
      },
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        isDragging.current = true;
        onSlidingStart?.();
        trackRef.current?.measure((_x, _y, width, _height, pageX) => {
          if (width > 0) {
            setTrackWidth(width);
            trackPageX.current = pageX;
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
      const next = Math.min(max, value + step * 2);
      onChange(Math.round(next * 10) / 10);
    } else if (event.nativeEvent.actionName === 'decrement') {
      const prev = Math.max(min, value - step * 2);
      onChange(Math.round(prev * 10) / 10);
    }
  };

  const activeTrackWidth = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const thumbTranslateX = animRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth > 0 ? trackWidth : 300],
  });

  return (
    <View className="w-full my-1">
      {/* Live Numeric Readout Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-dusk font-mono text-xs font-medium">
          {min} km
        </Text>
        <View className="px-3 py-1 rounded-full bg-ink border border-hairline">
          <Text className="text-moonlight font-mono text-xs font-bold">
            {displayValue >= max ? `${max}+ km (Anywhere / Virtual)` : `${displayValue.toFixed(1)} km`}
          </Text>
        </View>
        <Text className="text-dusk font-mono text-xs font-medium">
          {max}+ km
        </Text>
      </View>

      {/* Touch Interactive Track Area with Directional Gesture Filtering */}
      <View
        ref={trackRef}
        onLayout={handleLayout}
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel="Discovery radius slider"
        accessibilityValue={{
          min: Math.floor(min),
          max: Math.ceil(max),
          now: Math.round(displayValue),
          text: displayValue >= max ? `${max}+ km Anywhere` : `${displayValue.toFixed(1)} kilometers`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Increase radius' },
          { name: 'decrement', label: 'Decrease radius' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        {...panResponder.panHandlers}
        style={styles.touchContainer}
      >
        {/* Inactive Background Rail */}
        <View style={styles.trackRail} />

        {/* Active Filled Bar */}
        <Animated.View
          style={[
            styles.trackFilled,
            { width: activeTrackWidth },
          ]}
        />

        {/* Draggable Knob (GPU transform translateX) */}
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: thumbTranslateX }] },
          ]}
        >
          <View style={styles.thumbCenter} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchContainer: {
    height: 52,
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.001)',
  },
  trackRail: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2C2739', // hairline
    width: '100%',
  },
  trackFilled: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7B2FF7', // signal-violet
    left: 0,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F0FF', // Moonlight solid
    borderColor: '#7B2FF7',
    borderWidth: 2.5,
    marginLeft: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7B2FF7',
  },
});
