import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import {
  Clock,
  MapPin,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import { DiscoveryActivity } from './types';
import { formatDistance, getPinTheme } from './utils';
import { useAuthStore } from '../auth/useAuthStore';
import { useCountdown } from '../../hooks/useCountdown';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';

const SHEET_BACKGROUND = '#17131F';

const sheetStyles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: SHEET_BACKGROUND,
    paddingHorizontal: 20,
    // Clear the native drag handle. iOS uses the library's own 16pt indicator
    // padding (cancelled by the chrome bleed below), so the real gap is set here.
    // Android's Material handle already reserves its own space.
    paddingTop: Platform.select({ ios: 28, android: 12, default: 16 }),
    paddingBottom: 32,
  },
});

interface ActivityBottomSheetProps {
  activity: DiscoveryActivity | null;
  onClose: () => void;
  onRecenter?: () => void;
}

export function ActivityBottomSheet({
  activity,
  onClose,
}: ActivityBottomSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.user?.id);

  // `@expo/ui/community/bottom-sheet` hosts the RN content inside a native sheet
  // whose chrome (drag-handle zone + home-indicator safe area on iOS) lives outside
  // the RN layout. We bleed the opaque background into that chrome so the whole
  // sheet reads as one uniform surface. Android's Material sheet paints its chrome
  // from `backgroundStyle` (containerColor) and web from the drawer style, so
  // neither needs this.
  const iosChromeBleed: StyleProp<ViewStyle> =
    Platform.OS === 'ios'
      ? {
          marginTop: -16, // cancels the library's drag-indicator paddingTop
          marginBottom: -Math.max(insets.bottom, 16), // cancels the sheet's bottom safe area
        }
      : undefined;

  const { isExpired, formattedTtl, theme } = useCountdown(activity?.expiresAt);
  const isHost = currentUserId && activity ? activity.hostId === currentUserId : false;

  return (
    <BottomSheet
      index={activity ? 0 : -1}
      onClose={onClose}
      // Two detents so every platform exposes the same states: iOS opens at the
      // 50% detent and can grow; Android maps index 0 to Material's partial state
      // and the last index to expanded (a single snap point would force Android
      // to skip partial and open fully expanded); web maps them to CSS heights.
      snapPoints={['50%', '90%']}
      enablePanDownToClose={true}
      backgroundStyle={{ backgroundColor: SHEET_BACKGROUND }}
    >
      {activity ? (
        <BottomSheetView style={[sheetStyles.content, iosChromeBleed]}>
          {/* Header Row: Title */}
          <View className="mb-2">
            <Text className="text-moonlight font-display text-lg font-bold">
              {activity.title}
            </Text>
            {/* Host row */}
            <View className="flex-row items-center mt-1">
              <Text className="text-dusk font-medium text-xs mr-2">
                Host: {activity.hostName}
              </Text>
              {activity.hostIsVerified && <VerifiedBadge size={13} className="mr-2" />}
              <Text className="text-pulse-lilac font-mono text-xs font-bold">
                ★ {typeof activity.hostTrustScore === 'number' ? activity.hostTrustScore.toFixed(2) : '5.00'}
              </Text>
            </View>
          </View>

          {/* Stats Row: TTL Countdown + Distance + Capacity */}
          <View className="flex-row items-center justify-between bg-void/60 border border-hairline/60 rounded-2xl p-3 mb-3">
            {/* TTL remaining */}
            <View className="flex-row items-center">
              <Clock size={13} color={isExpired ? '#5A536B' : theme.primary} />
              <Text
                style={{ color: isExpired ? '#A99BC2' : theme.badgeText }}
                className="font-mono text-xs font-bold ml-1.5"
              >
                {isExpired ? 'Expired' : `${formattedTtl} left`}
              </Text>
            </View>

            {/* Distance */}
            <View className="flex-row items-center">
              <MapPin size={12} color="#A99BC2" />
              <Text className="text-dusk font-mono text-xs ml-1">
                {formatDistance(activity.distanceMeters)}
              </Text>
            </View>

            {/* Spots / Capacity */}
            <View className="flex-row items-center">
              <Users size={13} color="#C77DFF" />
              <Text className="text-moonlight font-mono text-xs font-semibold ml-1">
                {activity.currentParticipantsCount}/{activity.maxParticipants} spots
              </Text>
            </View>
          </View>

          {/* Venue Name if present */}
          {activity.venueName && (
            <View className="flex-row items-center mb-2.5">
              <MapPin size={12} color="#C77DFF" />
              <Text className="text-dusk font-body text-xs ml-1.5">
                Near {activity.venueName}
              </Text>
            </View>
          )}

          {/* Description snippet */}
          {activity.description ? (
            <Text
              numberOfLines={2}
              className="text-dusk text-xs mb-4 leading-relaxed"
            >
              {activity.description}
            </Text>
          ) : null}

          {/* Request to Join / Host Manage CTA Button */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isHost
                ? `Manage Squad Requests (${activity.currentParticipantsCount}/${activity.maxParticipants})`
                : `Request to Join Squad (${activity.currentParticipantsCount}/${activity.maxParticipants})`
            }
            onPress={() => {
              onClose();
              router.push(`/activity/${activity.id}`);
            }}
            className="w-full bg-signal-violet py-3.5 rounded-full flex-row items-center justify-center border border-signal-violet-light/30 active:scale-95"
            activeOpacity={0.85}
          >
            <Text className="text-moonlight font-display text-sm font-bold mr-1">
              {isHost
                ? `Manage Squad Requests (${activity.currentParticipantsCount}/${activity.maxParticipants})`
                : `Request to Join Squad (${activity.currentParticipantsCount}/${activity.maxParticipants})`}
            </Text>
            <ChevronRight size={16} color="#F5F0FF" />
          </TouchableOpacity>
        </BottomSheetView>
      ) : null}
    </BottomSheet>
  );
}
