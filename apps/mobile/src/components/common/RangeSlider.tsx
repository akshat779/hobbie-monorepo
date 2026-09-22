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

interface RangeSliderProps {
  minValue: number;
  maxValue: number;
  onChange: (minValue: number, maxValue: number) => void;
  onSlidingComplete?: (minValue: number, maxValue: number) => void;
  min: number;
  max: number;
  step?: number;
  minGap?: number;
  accessibilityLabel?: string;
}

export function RangeSlider({
  minValue,
  maxValue,
  onChange,
  onSlidingComplete,
  min,
  max,
  step = 1,
  minGap = 1,
  accessibilityLabel = 'Age range slider',
}: RangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageX = useRef(0);
  const trackRef = useRef<View>(null);
  const activeThumb = useRef<'min' | 'max' | null>(null);

  const lastMin = useRef(minValue);
  const lastMax = useRef(maxValue);

  const minRatio = Math.max(0, Math.min(1, (minValue - min) / (max - min)));
  const maxRatio = Math.max(0, Math.min(1, (maxValue - min) / (max - min)));

  const animMinRatio = useRef(new Animated.Value(minRatio)).current;
  const animMaxRatio = useRef(new Animated.Value(maxRatio)).current;

  const [displayMin, setDisplayMin] = useState(minValue);
  const [displayMax, setDisplayMax] = useState(maxValue);

  useEffect(() => {
    if (!activeThumb.current) {
      lastMin.current = minValue;
      lastMax.current = maxValue;
      setDisplayMin(minValue);
      setDisplayMax(maxValue);
      const rMin = Math.max(0, Math.min(1, (minValue - min) / (max - min)));
      const rMax = Math.max(0, Math.min(1, (maxValue - min) / (max - min)));
      animMinRatio.setValue(rMin);
      animMaxRatio.setValue(rMax);
    }
  }, [minValue, maxValue, min, max, animMinRatio, animMaxRatio]);

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
    if (currentTrackWidth <= 0 || !activeThumb.current) return;

    const x = pageX - trackPageX.current;
    const ratio = Math.max(0, Math.min(1, x / currentTrackWidth));
    const rawVal = min + ratio * (max - min);
    const stepped = Math.round(rawVal / step) * step;

    if (activeThumb.current === 'min') {
      const clampedMin = Math.max(min, Math.min(lastMax.current - minGap, stepped));
      const newRatio = Math.max(0, Math.min(1, (clampedMin - min) / (max - min)));
      animMinRatio.setValue(newRatio);

      if (clampedMin !== lastMin.current) {
        lastMin.current = clampedMin;
        setDisplayMin(clampedMin);
        onChange(clampedMin, lastMax.current);
      }
    } else {
      const clampedMax = Math.min(max, Math.max(lastMin.current + minGap, stepped));
      const newRatio = Math.max(0, Math.min(1, (clampedMax - min) / (max - min)));
      animMaxRatio.setValue(newRatio);

      if (clampedMax !== lastMax.current) {
        lastMax.current = clampedMax;
        setDisplayMax(clampedMax);
        onChange(lastMin.current, clampedMax);
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const pageX = evt.nativeEvent.pageX;
        trackRef.current?.measureInWindow((xOrigin, _y, width) => {
          if (width > 0) {
            trackWidthRef.current = width;
            trackPageX.current = xOrigin;
            setTrackWidth(width);
          }

          const relativeX = pageX - trackPageX.current;
          const currentTrackWidth = trackWidthRef.current || width || 280;

          const currentMinRatio = (lastMin.current - min) / (max - min);
          const currentMaxRatio = (lastMax.current - min) / (max - min);
          const minThumbPos = currentMinRatio * currentTrackWidth;
          const maxThumbPos = currentMaxRatio * currentTrackWidth;

          const distToMin = Math.abs(relativeX - minThumbPos);
          const distToMax = Math.abs(relativeX - maxThumbPos);

          activeThumb.current = distToMin <= distToMax ? 'min' : 'max';
          updateFromPageX(pageX);
        });
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        if (activeThumb.current) {
          updateFromPageX(evt.nativeEvent.pageX);
        }
      },
      onPanResponderRelease: () => {
        activeThumb.current = null;
        onSlidingComplete?.(lastMin.current, lastMax.current);
      },
      onPanResponderTerminate: () => {
        activeThumb.current = null;
        onSlidingComplete?.(lastMin.current, lastMax.current);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      const nextMax = Math.min(max, maxValue + step);
      onChange(minValue, nextMax);
    } else if (event.nativeEvent.actionName === 'decrement') {
      const prevMin = Math.max(min, minValue - step);
      onChange(prevMin, maxValue);
    }
  };

  const targetWidth = trackWidth > 0 ? trackWidth : 280;

  const minThumbX = animMinRatio.interpolate({
    inputRange: [0, 1],
    outputRange: [0, targetWidth],
  });

  const maxThumbX = animMaxRatio.interpolate({
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
          text: `${displayMin} to ${displayMax >= max ? `${max}+` : displayMax} years`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Expand range' },
          { name: 'decrement', label: 'Narrow range' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        {...panResponder.panHandlers}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.touchContainer}
      >
        {/* Inactive Background Rail */}
        <View style={styles.trackRail} />

        {/* Active Range Filled Track */}
        <Animated.View
          style={[
            styles.trackFilled,
            {
              left: minThumbX,
              right: Animated.subtract(targetWidth, maxThumbX),
            },
          ]}
        />

        {/* Left Thumb (Min Age) */}
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: minThumbX }] },
          ]}
        />

        {/* Right Thumb (Max Age) */}
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: maxThumbX }] },
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
