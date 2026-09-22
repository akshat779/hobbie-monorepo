import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Map, Rss, Users, User } from 'lucide-react-native';

const TAB_CONFIG: Record<
  string,
  {
    label: string;
    renderIcon: (color: string) => React.ReactNode;
  }
> = {
  index: {
    label: 'Hobbie',
    renderIcon: (color) => <Map size={21} color={color} strokeWidth={2.1} />,
  },
  list: {
    label: 'Feed',
    renderIcon: (color) => <Rss size={21} color={color} strokeWidth={2.1} />,
  },
  'my-activities': {
    label: 'My Squads',
    renderIcon: (color) => <Users size={21} color={color} strokeWidth={2.1} />,
  },
  profile: {
    label: 'Profile',
    renderIcon: (color) => <User size={21} color={color} strokeWidth={2.1} />,
  },
};

export function FloatingGlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const hasLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  // Grounded floating position framing the iOS home bar cleanly
  const bottomOffset = insets.bottom > 0 ? Math.max(insets.bottom - 16, 14) : 12;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerWrapper,
        { bottom: bottomOffset },
      ]}
    >
      <View style={styles.dockContainer}>
        {/* Apple Liquid Glass Backdrop if available */}
        {hasLiquidGlass && (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            style={[StyleSheet.absoluteFill, { borderRadius: 9999 }]}
          />
        )}

        {/* Tab Items Row */}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const config = TAB_CONFIG[route.name];
          if (!config) return null;

          const isFocused = state.index === index;
          const iconColor = isFocused ? '#F5F0FF' : '#A99BC2';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || config.label}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.75}
              style={styles.tabButton}
            >
              {/* WhatsApp-Style Full Item Highlight Pill (Icon + Text inside) */}
              <View
                style={[
                  styles.tabCapsule,
                  isFocused && styles.tabCapsuleActive,
                ]}
              >
                {config.renderIcon(iconColor)}
                <Text
                  style={[
                    styles.tabLabel,
                    isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {config.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  dockContainer: {
    width: '100%',
    maxWidth: 420,
    height: 68,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#2C2739',
    backgroundColor: '#17131F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCapsule: {
    width: 66,
    height: 52,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 3,
  },
  tabCapsuleActive: {
    backgroundColor: 'rgba(123, 47, 247, 0.25)',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#F5F0FF',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#A99BC2',
    fontWeight: '600',
  },
});
