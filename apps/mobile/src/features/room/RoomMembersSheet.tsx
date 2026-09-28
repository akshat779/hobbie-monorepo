import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Crown } from 'lucide-react-native';
import { useRoomMembersQuery } from './useRoomQuery';

import { Avatar } from '../../components/common/Avatar';
import { VerifiedBadge } from '../../components/common/VerifiedBadge';

interface RoomMembersSheetProps {
  visible: boolean;
  roomId: string;
  onClose: () => void;
}

/**
 * Bottom sheet listing the squad roster (host first). Tapping a member opens
 * their read-only public profile.
 */
export function RoomMembersSheet({ visible, roomId, onClose }: RoomMembersSheetProps) {
  const router = useRouter();
  const { data: members = [], isLoading } = useRoomMembersQuery(visible ? roomId : undefined);

  const openProfile = (userId: string) => {
    onClose();
    router.push(`/profile/${userId}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-void px-5 pt-4">
        <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-hairline">
          <View>
            <Text className="text-moonlight font-display text-lg font-bold">Squad members</Text>
            <Text className="text-dusk text-2xs mt-0.5">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close members"
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center"
            activeOpacity={0.7}
          >
            <X size={16} color="#F5F0FF" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#C77DFF" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {members.map((member) => (
              <TouchableOpacity
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${member.name}'s profile`}
                onPress={() => openProfile(member.id)}
                activeOpacity={0.7}
                className="flex-row items-center bg-ink border border-hairline rounded-2xl p-3 mb-2"
              >
                <Avatar name={member.name} url={member.avatarUrl ?? null} size={44} />
                <View className="flex-1 ml-3 mr-2">
                  <View className="flex-row items-center flex-wrap">
                    <Text className="text-moonlight font-display font-bold text-sm mr-2">
                      {member.name}
                    </Text>
                    {member.isVerified ? <VerifiedBadge size={13} /> : null}
                    {member.isHost ? (
                      <View className="flex-row items-center ml-2 bg-signal-violet/20 border border-signal-violet/50 px-2 py-0.5 rounded-full">
                        <Crown size={10} color="#C77DFF" />
                        <Text className="text-pulse-lilac text-2xs font-bold ml-1">Host</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-dusk text-2xs mt-0.5">
                    ★ {member.trustScore.toFixed(2)} trust
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
