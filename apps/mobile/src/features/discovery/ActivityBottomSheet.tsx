import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, RNHostView } from '@expo/ui';
import {
  Clock,
  MapPin,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import { DiscoveryActivity } from './types';
import { formatDistance } from './utils';
import { useAuthStore } from '../auth/useAuthStore';
import { useCountdown } from '../../hooks/useCountdown';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';

const SHEET_BACKGROUND = '#17131F';

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
  const { width } = useWindowDimensions();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { isExpired, formattedTtl, theme } = useCountdown(activity?.expiresAt);
  const isHost = currentUserId && activity ? activity.hostId === currentUserId : false;

  return (
    <BottomSheet
      isPresented={activity != null}
      onDismiss={onClose}
      // Paints the whole sheet surface (drag-indicator zone + home-indicator
      // inset) and opts the sheet out of the system's translucent Liquid Glass
      // material — the recommended cross-platform way to tint a sheet.
      containerColor={SHEET_BACKGROUND}
      // Horizontal padding is owned by the RN content below; the top inset keeps
      // the title clear of the native drag indicator.
      contentPadding={{ top: 20, bottom: 0, left: 0, right: 0 }}
    >
      {activity ? (
        <RNHostView matchContents>
          <View
            style={{
              width,
              backgroundColor: SHEET_BACKGROUND,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            {/*
              iOS 26 keeps the system Liquid Glass material in the sheet chrome
              (drag-indicator zone + home-indicator inset) even with a
              `presentationBackground`/`containerColor` set, so the sheet surface
              can't be tinted there. This absolutely-positioned, non-layout-
              affecting paint extends past the content bounds (and is clipped to
              the sheet shape) to cover that chrome without adding a fixed detent
              or any dead space.
            */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: SHEET_BACKGROUND,
                // scaleY (unlike negative insets) is a render-only transform, so
                // it never contributes to the sheet's measured height.
                transform: [{ scaleY: 2.5 }],
              }}
            />

            {/* Header Row: Title */}
            <View className="mb-4">
              <Text className="text-moonlight font-display text-xl font-bold">
                {activity.title}
              </Text>
              {/* Host row */}
              <View className="flex-row items-center mt-2">
                <Text className="text-dusk font-medium text-sm mr-2">
                  Host: {activity.hostName}
                </Text>
                {activity.hostIsVerified && <VerifiedBadge size={15} className="mr-2" />}
                <Text className="text-pulse-lilac font-mono text-sm font-bold">
                  ★ {typeof activity.hostTrustScore === 'number' ? activity.hostTrustScore.toFixed(2) : '5.00'}
                </Text>
              </View>
            </View>

            {/* Stats Row: TTL Countdown + Distance + Capacity */}
            <View className="flex-row items-center justify-between bg-void/60 border border-hairline/60 rounded-2xl p-4 mb-4">
              {/* TTL remaining */}
              <View className="flex-row items-center">
                <Clock size={16} color={isExpired ? '#5A536B' : theme.primary} />
                <Text
                  style={{ color: isExpired ? '#A99BC2' : theme.badgeText }}
                  className="font-mono text-sm font-bold ml-1.5"
                >
                  {isExpired ? 'Expired' : `${formattedTtl} left`}
                </Text>
              </View>

              {/* Distance */}
              <View className="flex-row items-center">
                <MapPin size={15} color="#A99BC2" />
                <Text className="text-dusk font-mono text-sm ml-1.5">
                  {formatDistance(activity.distanceMeters)}
                </Text>
              </View>

              {/* Spots / Capacity */}
              <View className="flex-row items-center">
                <Users size={16} color="#C77DFF" />
                <Text className="text-moonlight font-mono text-sm font-semibold ml-1.5">
                  {activity.currentParticipantsCount}/{activity.maxParticipants} spots
                </Text>
              </View>
            </View>

            {/* Venue Name if present */}
            {activity.venueName && (
              <View className="flex-row items-center mb-4">
                <MapPin size={15} color="#C77DFF" />
                <Text className="text-dusk font-body text-sm ml-1.5">
                  Near {activity.venueName}
                </Text>
              </View>
            )}

            {/* Description snippet */}
            {activity.description ? (
              <Text
                numberOfLines={2}
                className="text-dusk text-base mb-6 leading-relaxed"
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
              className="w-full bg-signal-violet py-4 rounded-full flex-row items-center justify-center border border-signal-violet-light/30 active:scale-95"
              activeOpacity={0.85}
            >
              <Text className="text-moonlight font-display text-base font-bold mr-1.5">
                {isHost
                  ? `Manage Squad Requests (${activity.currentParticipantsCount}/${activity.maxParticipants})`
                  : `Request to Join Squad (${activity.currentParticipantsCount}/${activity.maxParticipants})`}
              </Text>
              <ChevronRight size={18} color="#F5F0FF" />
            </TouchableOpacity>
          </View>
        </RNHostView>
      ) : null}
    </BottomSheet>
  );
}
