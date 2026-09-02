import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ShieldCheck,
  Clock,
  MapPin,
  Users,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { NearbyActivity } from './types';
import { formatDistance, getPinTheme } from './utils';

interface ActivityBottomSheetProps {
  activity: NearbyActivity | null;
  onClose: () => void;
}

export function ActivityBottomSheet({
  activity,
  onClose,
}: ActivityBottomSheetProps) {
  const router = useRouter();

  if (!activity) return null;

  const { ttlStatus } = activity;
  const theme = getPinTheme(ttlStatus.urgency);

  return (
    <View className="bg-ink border-t border-hairline px-5 pt-3 pb-8 rounded-t-3xl">
      {/* Top Handle Bar */}
      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.6}
        className="py-1 self-center w-16 items-center mb-2"
      >
        <View className="w-10 h-1 bg-hairline rounded-full" />
      </TouchableOpacity>

      {/* Header Row: Title + Close Button */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-moonlight font-display text-lg font-bold">
            {activity.title}
          </Text>
          {/* Host row */}
          <View className="flex-row items-center mt-1">
            <Text className="text-dusk font-medium text-xs mr-2">
              Host: {activity.hostName}
            </Text>
            {activity.hostIsVerified && (
              <View className="bg-signal-violet/20 border border-signal-violet/50 px-1.5 py-0.5 rounded-full flex-row items-center mr-2">
                <ShieldCheck size={10} color="#D2BBFF" />
                <Text className="text-signal-violet-light text-[10px] font-bold ml-1">
                  Verified
                </Text>
              </View>
            )}
            <Text className="text-pulse-lilac font-mono text-xs font-bold">
              ★ {activity.hostTrustScore.toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onClose}
          className="w-7 h-7 rounded-full bg-ink-raised border border-hairline items-center justify-center"
          activeOpacity={0.7}
        >
          <X size={13} color="#A99BC2" />
        </TouchableOpacity>
      </View>

      {/* Stats Row: TTL Countdown + Distance + Capacity */}
      <View className="flex-row items-center justify-between bg-void/60 border border-hairline/60 rounded-2xl p-3 mb-3">
        {/* TTL remaining */}
        <View className="flex-row items-center">
          <Clock size={13} color={theme.primary} />
          <Text
            style={{ color: theme.badgeText }}
            className="font-mono text-xs font-bold ml-1.5"
          >
            {ttlStatus.urgency === 'expired'
              ? 'Expired'
              : `${ttlStatus.formattedTtl} left`}
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

      {/* Request to Join CTA Button */}
      <TouchableOpacity
        onPress={() => router.push(`/activity/${activity.id}`)}
        className="w-full bg-signal-violet py-3.5 rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
        activeOpacity={0.85}
      >
        <Text className="text-moonlight font-display text-sm font-bold mr-1">
          Request to Join Squad ({activity.currentParticipantsCount}/
          {activity.maxParticipants})
        </Text>
        <ChevronRight size={16} color="#F5F0FF" />
      </TouchableOpacity>
    </View>
  );
}
