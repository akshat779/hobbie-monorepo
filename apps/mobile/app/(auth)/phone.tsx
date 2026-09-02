import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Sparkles, ArrowRight, Zap } from 'lucide-react-native';
import { useAuthStore, DEV_PERSONAS } from '../../src/features/auth/useAuthStore';
import { PhoneAuthSchema } from '@hobbie/shared';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode] = useState('+91');
  const [errorMsg, setErrorMsg] = useState('');
  const { signInWithPhone, loginWithPersona, isLoading } = useAuthStore();

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

  const handleQuickPersona = async (personaId: string) => {
    await loginWithPersona(personaId);
    router.replace('/(main)');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-between px-6 py-6"
      >
        {/* Header Branding */}
        <View className="pt-4">
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center space-x-2">
              <View className="w-9 h-9 rounded-xl bg-ink-raised border border-hairline items-center justify-center">
                <Sparkles size={18} color="#C77DFF" />
              </View>
              <Text className="text-xl font-bold font-display text-moonlight tracking-tight ml-2">
                Hobbie
              </Text>
            </View>

            <View className="flex-row items-center px-2.5 py-1 rounded-full bg-ink border border-hairline">
              <Shield size={12} color="#A99BC2" />
              <Text className="text-xs text-dusk font-medium ml-1.5">Verified Matching</Text>
            </View>
          </View>

          {/* Main Title & Subtitle */}
          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-2">
            Enter your mobile number
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            We’ll send a 6-digit verification code to confirm your physical identity.
          </Text>
        </View>

        {/* Input Form */}
        <View className="my-auto py-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2 ml-1">
            Mobile Number
          </Text>
          <View className="flex-row items-center h-14 bg-ink rounded-2xl border border-hairline px-4 focus:border-signal-violet">
            <View className="flex-row items-center pr-3 mr-3 border-r border-hairline">
              <Text className="text-base font-semibold text-moonlight">{countryCode}</Text>
            </View>
            <TextInput
              className="flex-1 text-base text-moonlight font-medium"
              placeholder="98765 43210"
              placeholderTextColor="#5A536B"
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text);
                if (errorMsg) setErrorMsg('');
              }}
              autoFocus
            />
          </View>

          {errorMsg ? (
            <Text className="text-xs text-ember font-medium mt-2 ml-1">{errorMsg}</Text>
          ) : null}

          {/* Primary CTA */}
          <TouchableOpacity
            className={`h-14 mt-5 rounded-full flex-row items-center justify-center ${
              phoneNumber.length >= 10 ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
            }`}
            onPress={handleSendOtp}
            disabled={isLoading || phoneNumber.length < 10}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#F5F0FF" />
            ) : (
              <>
                <Text
                  className={`text-base font-bold font-display ${
                    phoneNumber.length >= 10 ? 'text-moonlight' : 'text-dusk'
                  }`}
                >
                  Send Verification Code
                </Text>
                <ArrowRight
                  size={18}
                  color={phoneNumber.length >= 10 ? '#F5F0FF' : '#A99BC2'}
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Dev Quick Personas Bypass */}
        <View className="pt-4 border-t border-hairline/60">
          <View className="flex-row items-center mb-3">
            <Zap size={14} color="#C77DFF" />
            <Text className="text-xs font-semibold text-dusk uppercase tracking-wider ml-1.5">
              Instant Dev Personas (1-Tap)
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {DEV_PERSONAS.slice(0, 3).map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleQuickPersona(p.id)}
                className="px-3.5 py-2 rounded-xl bg-ink border border-hairline flex-row items-center"
                activeOpacity={0.7}
              >
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    p.role === 'host' ? 'bg-signal-violet' : 'bg-pulse-lilac'
                  }`}
                />
                <Text className="text-xs font-medium text-moonlight">
                  {p.name.split(' ')[0]} ({p.role})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
