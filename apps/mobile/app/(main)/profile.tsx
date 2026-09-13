import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, LogOut, Sparkles, Zap } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, DEV_PERSONAS } from '../../src/features/auth/useAuthStore';
import { HobbieLogo } from '../../src/components/common/HobbieLogo';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, activePersonaId, loginWithPersona, signOut } = useAuthStore(
    useShallow((s) => ({
      profile: s.profile,
      activePersonaId: s.activePersonaId,
      loginWithPersona: s.loginWithPersona,
      signOut: s.signOut,
    }))
  );
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);

  const handleSignOut = async () => {
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
        <Text className="text-dusk font-display text-sm mt-3">Loading profile...</Text>
      </View>
    );
  }

  const displayName = profile.name || 'Anonymous Member';
  const displayPhone = profile.phone;
  const trustScore = profile.trust_score ?? 5.0;
  const isVerified = Boolean(profile.is_verified);
  const interests = profile.interests || [];

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16) }}
      className="flex-1 bg-void px-5"
    >
      {/* Screen Title */}
      <View className="mb-6">
        <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight">
          Profile & Trust
        </Text>
        <Text className="text-xs text-dusk mt-0.5">
          Zero public vanity metrics • Pure squad reputation
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 100 }}
        className="flex-1"
      >
        {/* Identity & Rep Card */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-bold font-display text-moonlight">
              {displayName}
            </Text>
            {isVerified && (
              <View className="bg-signal-violet/20 border border-signal-violet px-2.5 py-0.5 rounded-full flex-row items-center">
                <ShieldCheck size={12} color="#D2BBFF" />
                <Text className="text-signal-violet-light text-xs font-bold ml-1">
                  Face Verified
                </Text>
              </View>
            )}
          </View>

          <Text className="text-xs font-mono text-dusk mb-3">
            {displayPhone
              ? displayPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1 •••• $2')
              : 'No phone linked'}
          </Text>

          <View className="bg-void/60 border border-hairline/60 p-3 rounded-2xl">
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-dusk">Rolling Trust Score</Text>
              <Text className="text-pulse-lilac font-mono text-sm font-bold">
                ★ {trustScore.toFixed(2)} / 5.00
              </Text>
            </View>
            <Text className="text-2xs text-dusk/70 mt-1">
              Calculated dynamically over your last 10 peer squad interactions.
            </Text>
          </View>
        </View>

        {/* Active Interests */}
        <View className="bg-ink border border-hairline p-5 rounded-3xl mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold font-display text-moonlight">
              My Hobbie Interests
            </Text>
            <Sparkles size={14} color="#C77DFF" />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {interests.map((tag) => (
              <View
                key={tag}
                className="bg-void border border-hairline px-3.5 py-1.5 rounded-full"
              >
                <Text className="text-pulse-lilac text-xs font-semibold capitalize">
                  {tag.replace('_', ' ')}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Developer Persona Switcher Section */}
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

        {/* Sign Out Button */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={handleSignOut}
          className="w-full h-14 bg-ink border border-hairline rounded-full flex-row items-center justify-center mb-6"
          activeOpacity={0.7}
        >
          <LogOut size={16} color="#FF6B5E" style={{ marginRight: 8 }} />
          <Text className="text-ember font-display text-sm font-bold">Sign Out</Text>
        </TouchableOpacity>

        {/* Brand Signature Footer */}
        <View className="items-center justify-center pt-2 pb-10 opacity-50">
          <HobbieLogo width={110} />
          <Text className="text-2xs text-dusk font-mono mt-2">v0.1.0 • Nocturnal Pulse</Text>
        </View>
      </ScrollView>
    </View>
  );
}
