import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LogOut,
  Sparkles,
  Zap,
  Languages,
  Pencil,
  Star,
  Camera,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { calculateAge, interestLabel, languageLabel } from '@hobbie/shared';
import { useAuthStore, DEV_PERSONAS } from '../../src/features/auth/useAuthStore';
import { HobbieLogo } from '../../src/components/common/HobbieLogo';
import { Avatar } from '../../src/components/common/Avatar';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { useFloatingTabBarClearance } from '../../src/components/navigation/FloatingGlassTabBar';
import { GENDER_LABELS, getInterestIcon } from '../../src/features/profile/profileMeta';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useFloatingTabBarClearance();
  const queryClient = useQueryClient();
  const { profile, activePersonaId, isDevMode, loginWithPersona, signOut } = useAuthStore(
    useShallow((s) => ({
      profile: s.profile,
      activePersonaId: s.activePersonaId,
      isDevMode: s.isDevMode,
      loginWithPersona: s.loginWithPersona,
      signOut: s.signOut,
    }))
  );
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);

  // If cold-started without active profile in dev mode, immediately hydrate default persona
  useEffect(() => {
    if (!profile && isDevMode) {
      void loginWithPersona(DEV_PERSONAS[0]!.id);
    }
  }, [profile, isDevMode, loginWithPersona]);

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut();
    router.replace('/');
  };

  if (!profile) {
    return (
      <View
        style={{ paddingTop: Math.max(insets.top, 16) }}
        className="flex-1 bg-void px-5 justify-center items-center"
      >
        <ActivityIndicator size="large" color="#C77DFF" />
        <Text className="text-dusk font-display text-sm mt-3">Connecting to profile...</Text>
        {isDevMode && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Load demo persona"
            onPress={() => loginWithPersona(DEV_PERSONAS[0]!.id)}
            className="mt-5 px-4 py-2.5 bg-ink border border-signal-violet/60 rounded-full"
            activeOpacity={0.8}
          >
            <Text className="text-pulse-lilac text-xs font-mono font-bold">
              Load Demo Persona (Alex Rivera)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const displayName = profile.name || 'Anonymous Member';
  const trustScore = profile.trust_score ?? 5.0;
  const interactionCount = profile.interaction_count ?? 0;
  const isVerified = Boolean(profile.is_verified);
  const interests = profile.interests || [];
  const languages = profile.preferred_languages || [];
  const bio = profile.bio;
  const age = calculateAge(profile.birth_date);
  const genderLabel = GENDER_LABELS[profile.gender];
  const trustContext =
    interactionCount === 0
      ? 'New member — your score updates after each completed squad.'
      : `Calculated from your last ${Math.min(interactionCount, 10)} squad interaction${
          Math.min(interactionCount, 10) === 1 ? '' : 's'
        }.`;

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5"
    >
      {/* Screen Title + Primary Edit Action */}
      <View className="flex-row items-center justify-between mb-5">
        <Text className="text-2xl font-extrabold font-display text-moonlight tracking-tight">
          Profile
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={() => router.push('/profile/edit')}
          activeOpacity={0.8}
          className="h-10 px-4 rounded-full bg-ink border border-hairline flex-row items-center"
        >
          <Pencil size={14} color="#C77DFF" />
          <Text className="text-pulse-lilac text-xs font-bold ml-1.5">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
        className="flex-1"
      >
        {/* Identity Hero */}
        <View className="items-center mb-6">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.85}
            className="relative"
          >
            <Avatar
              name={displayName}
              url={profile.avatar_url}
              size={96}
              className="border border-hairline"
            />
            <View className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-signal-violet items-center justify-center border-2 border-void">
              <Camera size={15} color="#F5F0FF" />
            </View>
          </TouchableOpacity>

          <View className="flex-row items-center mt-3">
            <Text className="text-2xl font-bold font-display text-moonlight">
              {displayName}
              {age !== null ? `, ${age}` : ''}
            </Text>
            {isVerified && <VerifiedBadge size={16} className="ml-2" />}
          </View>

          <Text className="text-xs text-dusk mt-1">{genderLabel}</Text>

          {bio ? (
            <Text className="text-xs text-dusk leading-relaxed text-center mt-3 px-4" selectable>
              {bio}
            </Text>
          ) : null}
        </View>

        {/* Trust Score */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold font-display text-moonlight">Trust Score</Text>
            <Star size={14} color="#C77DFF" />
          </View>
          <View className="flex-row items-baseline mt-2">
            <Text className="text-pulse-lilac font-mono text-3xl font-bold">
              ★ {trustScore.toFixed(2)}
            </Text>
            <Text className="text-dusk font-mono text-xs ml-1.5">/ 5.00</Text>
          </View>
          <Text className="text-2xs text-dusk/80 mt-2 leading-relaxed">{trustContext}</Text>
        </View>

        {/* Preferred Languages */}
        {languages.length > 0 ? (
          <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold font-display text-moonlight">
                Preferred Languages
              </Text>
              <Languages size={14} color="#C77DFF" />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {languages.map((code) => (
                <View
                  key={code}
                  className="bg-void border border-hairline px-3.5 py-1.5 rounded-full"
                >
                  <Text className="text-pulse-lilac text-xs font-semibold">
                    {languageLabel(code)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Active Interests */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold font-display text-moonlight">
              My Hobbie Interests
            </Text>
            <Sparkles size={14} color="#C77DFF" />
          </View>
          {interests.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {interests.map((tag) => (
                <View
                  key={tag}
                  className="bg-void border border-hairline px-3 py-1.5 rounded-full flex-row items-center"
                >
                  {getInterestIcon(tag, '#C77DFF', 13)}
                  <Text className="text-pulse-lilac text-xs font-semibold ml-1.5">
                    {interestLabel(tag)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-dusk">No interests added yet.</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add interests"
                onPress={() => router.push('/profile/edit')}
                activeOpacity={0.7}
                className="px-3 py-1.5 rounded-full bg-signal-violet/20 border border-signal-violet"
              >
                <Text className="text-pulse-lilac text-xs font-bold">Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Action */}
        <View className="bg-ink border border-hairline rounded-3xl overflow-hidden mb-6">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={handleSignOut}
            activeOpacity={0.7}
            className="h-14 px-5 flex-row items-center"
          >
            <LogOut size={16} color="#FF6B5E" />
            <Text className="text-sm text-ember font-display font-semibold ml-3">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Persona Switcher (development builds only) */}
        {isDevMode ? (
          <View className="bg-ink border border-hairline p-5 rounded-3xl mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Zap size={14} color="#C77DFF" />
                <Text className="text-xs font-bold uppercase tracking-wider text-pulse-lilac ml-1.5">
                  Dev Persona Switcher
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={personaPickerOpen ? 'Hide persona picker' : 'Switch dev persona'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setPersonaPickerOpen(!personaPickerOpen)}
                className="min-h-[40px] px-3.5 py-2 rounded-full bg-ink-raised border border-hairline items-center justify-center"
              >
                <Text className="text-2xs font-mono text-moonlight font-bold">
                  {personaPickerOpen ? 'Hide' : 'Switch'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-2xs text-dusk mb-3">
              Test multi-user squad matching with different verified personas.
            </Text>

            {personaPickerOpen && (
              <View className="space-y-2 mt-1">
                {DEV_PERSONAS.map((p) => {
                  const isSelected = (activePersonaId || DEV_PERSONAS[0]!.id) === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Switch to ${p.name}, role ${p.role}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={async () => {
                        await loginWithPersona(p.id);
                        setPersonaPickerOpen(false);
                      }}
                      className={`p-3 rounded-2xl mb-1.5 border flex-row justify-between items-center ${
                        isSelected
                          ? 'border-signal-violet bg-signal-violet/15'
                          : 'border-hairline bg-void'
                      }`}
                      activeOpacity={0.7}
                    >
                      <View>
                        <Text className="text-xs font-bold font-display text-moonlight">
                          {p.name}
                        </Text>
                        <Text className="text-2xs text-dusk capitalize">
                          Role: {p.role} • ★ {p.trustScore}
                        </Text>
                      </View>
                      {isSelected && (
                        <View className="px-2 py-0.5 rounded-full bg-signal-violet">
                          <Text className="text-2xs text-moonlight font-bold">Active</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* Brand Signature Footer */}
        <View className="items-center justify-center pt-2 pb-10 opacity-50">
          <HobbieLogo width={110} />
          <Text className="text-2xs text-dusk font-mono mt-2">v0.1.0 • Nocturnal Pulse</Text>
        </View>
      </ScrollView>
    </View>
  );
}
