import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Host } from '@expo/ui';
import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import {
  ShieldCheck,
  Clock,
  MapPin,
  Users,
  ChevronRight,
} from 'lucide-react-native';
import { DiscoveryActivity } from './types';
import { formatDistance, getPinTheme } from './utils';
import { useAuthStore } from '../auth/useAuthStore';
import { useCountdown } from '../../hooks/useCountdown';

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
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { isExpired, formattedTtl, theme } = useCountdown(activity?.expiresAt);
  const isHost = currentUserId && activity ? activity.hostId === currentUserId : false;

  return (
    <Host colorScheme="dark">
      <BottomSheet
        index={activity ? 0 : -1}
        onClose={onClose}
        snapPoints={['50%']}
        enablePanDownToClose={true}
        backgroundStyle={{ backgroundColor: '#17131F' }}
      >
        {activity ? (
          <BottomSheetView style={{ backgroundColor: '#17131F', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
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
                {activity.hostIsVerified && (
                  <View className="bg-signal-violet/20 border border-signal-violet/50 px-2 py-0.5 rounded-full flex-row items-center mr-2">
                    <ShieldCheck size={11} color="#D2BBFF" />
                    <Text className="text-signal-violet-light text-2xs font-bold ml-1">
                      Verified
                    </Text>
                  </View>
                )}
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
  </Host>
);
}
