import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserCheck } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { parseIsoDate, UserProfileSchema } from '@hobbie/shared';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { ProfileForm, type ProfileFormValues } from '../../src/features/profile/ProfileForm';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, user, upsertProfile } = useAuthStore(
    useShallow((s) => ({
      profile: s.profile,
      user: s.user,
      upsertProfile: s.upsertProfile,
    }))
  );

  if (!profile) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-void">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C77DFF" />
          <Text className="text-dusk font-display text-sm mt-3">Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Re-validate stored values against the shared contract before prefilling so
  // the form can never start from a value the schema would reject.
  const parsedGender = UserProfileSchema.shape.gender.safeParse(profile.gender);
  const parsedInterests = UserProfileSchema.shape.interests.safeParse(profile.interests);
  const parsedLanguages = UserProfileSchema.shape.preferredLanguages.safeParse(
    profile.preferred_languages
  );

  const initialValues: ProfileFormValues = {
    name: profile.name,
    bio: profile.bio,
    birthDate: parseIsoDate(profile.birth_date),
    gender: parsedGender.success ? parsedGender.data : 'male',
    interests: parsedInterests.success ? parsedInterests.data : [],
    preferredLanguages: parsedLanguages.success ? parsedLanguages.data : [],
    avatarUrl: profile.avatar_url,
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-void">
      <ProfileForm
        userId={user?.id}
        submitLabel="Save"
        submitPlacement="top"
        initialValues={initialValues}
        onBack={() => router.back()}
        onSubmit={(input) => upsertProfile(input)}
        onSuccess={() => router.back()}
        header={
          <View className="mb-7">
            <View className="flex-row items-center gap-2 mb-2">
              <UserCheck size={20} color="#C77DFF" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac">
                Profile
              </Text>
            </View>
            <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
              Edit profile
            </Text>
            <Text className="text-sm text-dusk leading-relaxed">
              Keep your identity and squad preferences up to date.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
