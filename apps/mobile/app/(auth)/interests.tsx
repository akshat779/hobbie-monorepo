import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { ProfileForm } from '../../src/features/profile/ProfileForm';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { upsertProfile, user } = useAuthStore(
    useShallow((s) => ({
      upsertProfile: s.upsertProfile,
      user: s.user,
    }))
  );

  return (
    <ProfileForm
      userId={user?.id}
      submitLabel="Enter Hobbie"
      onSubmit={(input) => upsertProfile(input)}
      onSuccess={() => router.replace('/(main)')}
      header={
        <View className="mb-7">
          <View className="flex-row items-center gap-2 mb-2">
            <UserCheck size={20} color="#C77DFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac">
              Profile Setup
            </Text>
          </View>
          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
            Build your identity
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            Add a photo, tell squads who you are and pick the activities you want on your radar.
          </Text>
        </View>
      }
    />
  );
}
