import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Shield } from 'lucide-react-native';
import { useAuthStore } from '../src/features/auth/useAuthStore';
import { HobbieLogo } from '../src/components/common/HobbieLogo';

export default function WelcomeLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initialize, user, profile } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 24),
      }}
      className="flex-1 bg-void justify-between px-6"
    >
      {/* Top Brand Pill & Hero Logo */}
      <View className="items-center pt-8">
        <View className="flex-row items-center px-3.5 py-1.5 rounded-full bg-ink border border-hairline mb-12">
          <Shield size={14} color="#C77DFF" />
          <Text className="text-xs font-semibold text-pulse-lilac ml-1.5">
            Hyperlocal Physical Squads
          </Text>
        </View>

        {/* Bespoke Hobbie Wordmark SVG Logo */}
        <View className="items-center justify-center my-6">
          <HobbieLogo width={240} />
        </View>

        <Text className="text-base text-dusk text-center px-4 leading-relaxed mt-4">
          Activity-anchored coordination. Match with verified squads within 4.5km right now.
        </Text>
      </View>

      {/* Bottom CTA Actions */}
      <View className="w-full space-y-3">
        <TouchableOpacity
          onPress={() => router.push('/(auth)/phone')}
          className="w-full h-14 bg-signal-violet rounded-full flex-row items-center justify-center border border-signal-violet-light/30"
          activeOpacity={0.8}
        >
          <Text className="text-moonlight font-display text-lg font-bold">
            {user && profile ? 'Continue to Squads' : 'Get Started'}
          </Text>
          <ArrowRight size={18} color="#F5F0FF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(main)')}
          className="w-full h-14 bg-ink border border-hairline rounded-full items-center justify-center mt-3"
          activeOpacity={0.7}
        >
          <Text className="text-dusk font-medium text-sm">
            Explore Hobbie (Demo Mode)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
