import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Shield, ArrowRight } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { PhoneAuthSchema } from '@hobbie/shared';
import { HobbieLogo } from '../../src/components/common/HobbieLogo';
import { useKeyboardInset } from '../../src/hooks/useKeyboardInset';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode] = useState('+91');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<TextInput>(null);
  const keyboardInset = useKeyboardInset();
  const { signInWithPhone, isLoading } = useAuthStore(
    useShallow((s) => ({
      signInWithPhone: s.signInWithPhone,
      isLoading: s.isLoading,
    }))
  );

  // Focus after the navigation transition settles; a bare `autoFocus` on a
  // pushed screen is dropped by iOS, leaving the numeric keypad closed.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }, [])
  );

  const handleSendOtp = async () => {
    setErrorMsg('');
    const fullPhone = `${countryCode}${phoneNumber.trim().replace(/\D/g, '')}`;

    const validation = PhoneAuthSchema.safeParse({ phone: fullPhone });
    if (!validation.success) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    const res = await signInWithPhone(fullPhone);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    router.push({
      pathname: '/(auth)/otp',
      params: { phone: fullPhone },
    });
  };

  const canContinue = phoneNumber.length >= 10;

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-void">
        {/* Top-anchored content keeps the field under the heading and stable
            when the keyboard opens. */}
        <View className="flex-1 px-6 pt-4">
          <View className="flex-row items-center justify-between mb-8">
            <HobbieLogo width={120} />

            <View className="flex-row items-center px-2.5 py-1 rounded-full bg-ink border border-hairline">
              <Shield size={12} color="#A99BC2" />
              <Text className="text-xs text-dusk font-medium ml-1.5">Verified Matching</Text>
            </View>
          </View>

          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-2">
            Enter your mobile number
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            We’ll send a 6-digit verification code to confirm your physical identity.
          </Text>

          <View className="mt-10">
            <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2 ml-1">
              Mobile Number
            </Text>
            <View className="flex-row items-center h-14 bg-ink rounded-2xl border border-hairline px-4">
              <View className="flex-row items-center pr-3 mr-3 border-r border-hairline">
                <Text className="text-base font-semibold text-moonlight">{countryCode}</Text>
              </View>
              <TextInput
                ref={inputRef}
                className="flex-1 text-base text-moonlight font-medium"
                placeholder="98765 43210"
                placeholderTextColor="#5A536B"
                keyboardType="number-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text);
                  if (errorMsg) setErrorMsg('');
                }}
              />
            </View>

            {errorMsg ? (
              <Text className="text-xs text-ember font-medium mt-2 ml-1">{errorMsg}</Text>
            ) : null}
          </View>
        </View>

        {/* Bottom-pinned CTA that lifts above the keypad (iOS) so there is a
            natural gap above it when the keyboard is closed. */}
        <View className="px-6 pb-5" style={{ marginBottom: keyboardInset }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send Verification Code"
            className={`h-14 rounded-full flex-row items-center justify-center ${
              canContinue ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
            }`}
            onPress={handleSendOtp}
            disabled={isLoading || !canContinue}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#F5F0FF" />
            ) : (
              <>
                <Text
                  className={`text-base font-bold font-display ${
                    canContinue ? 'text-moonlight' : 'text-dusk'
                  }`}
                >
                  Send Verification Code
                </Text>
                <ArrowRight
                  size={18}
                  color={canContinue ? '#F5F0FF' : '#A99BC2'}
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
