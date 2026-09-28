import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, RotateCcw, ShieldCheck, Zap } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { useKeyboardInset } from '../../src/hooks/useKeyboardInset';

const OTP_LENGTH = 6;

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone;

  const [code, setCode] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<TextInput>(null);
  const submittedRef = useRef(false);
  const keyboardInset = useKeyboardInset();
  const { verifyOtp, signInWithPhone, isLoading } = useAuthStore(
    useShallow((s) => ({
      verifyOtp: s.verifyOtp,
      signInWithPhone: s.signInWithPhone,
      isLoading: s.isLoading,
    }))
  );

  useEffect(() => {
    if (!phone) {
      router.replace('/(auth)/phone');
    }
  }, [phone, router]);

  // Focus after the push transition so the numeric keypad reliably opens.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const digits = code.split('');

  const submitOtp = async (value: string) => {
    if (!phone || submittedRef.current) return;
    if (value.length !== OTP_LENGTH) return;
    submittedRef.current = true;
    setErrorMsg('');

    const res = await verifyOtp(phone, value);
    if (res.error) {
      setErrorMsg(res.error);
      submittedRef.current = false;
      return;
    }

    if (res.hasProfile) {
      router.replace('/(main)');
    } else {
      router.replace('/(auth)/interests');
    }
  };

  const handleChangeCode = (value: string) => {
    setErrorMsg('');
    const clean = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(clean);
    if (clean.length === OTP_LENGTH) {
      void submitOtp(clean);
    }
  };

  const handleResendOtp = async () => {
    if (timerSeconds > 0 || !phone) return;
    setTimerSeconds(60);
    setErrorMsg('');
    setCode('');
    submittedRef.current = false;
    await signInWithPhone(phone);
    inputRef.current?.focus();
  };

  const handleDevBypass = () => {
    handleChangeCode('123456');
  };

  const isComplete = code.length === OTP_LENGTH;

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-void">
        <View className="flex-1 px-6 pt-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full bg-ink border border-hairline items-center justify-center mb-6"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="flex-row items-center mb-2">
            <ShieldCheck size={20} color="#C77DFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac ml-1.5">
              Secure Verification
            </Text>
          </View>

          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-2">
            Enter 6-digit code
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            Sent via SMS to <Text className="font-semibold text-moonlight">{phone}</Text>
          </Text>

          {/* 6 visual boxes driven by one hidden numeric input: reliable keypad,
              paste, and iOS one-time-code autofill. */}
          <View className="mt-10">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Enter verification code"
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              className="flex-row justify-between"
            >
              {Array.from({ length: OTP_LENGTH }).map((_, idx) => {
                const digit = digits[idx] ?? '';
                const isActive = idx === code.length && !isComplete;
                return (
                  <View
                    key={idx}
                    className={`w-12 h-14 bg-ink rounded-2xl border items-center justify-center ${
                      digit
                        ? 'border-signal-violet bg-ink-raised'
                        : isActive
                          ? 'border-signal-violet'
                          : 'border-hairline'
                    }`}
                  >
                    <Text className="text-xl font-bold font-mono text-moonlight">{digit}</Text>
                  </View>
                );
              })}
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={handleChangeCode}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              caretHidden
              className="absolute left-0 right-0 top-0 h-14 text-transparent"
              style={{ opacity: 0.02 }}
            />

            {errorMsg ? (
              <Text className="text-xs text-ember font-medium text-center mt-4">{errorMsg}</Text>
            ) : null}

            <View className="flex-row items-center justify-center mt-5">
              {timerSeconds > 0 ? (
                <Text className="text-xs text-dusk font-mono">
                  Resend code in <Text className="font-bold text-moonlight">{timerSeconds}s</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Resend SMS code"
                  onPress={handleResendOtp}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  className="flex-row items-center min-h-[44px] py-2.5 px-4 rounded-full bg-ink border border-hairline justify-center"
                >
                  <RotateCcw size={14} color="#C77DFF" />
                  <Text className="text-xs font-semibold text-pulse-lilac ml-1.5">Resend SMS</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Bottom-pinned CTA that lifts above the keypad (iOS). */}
        <View className="px-6 pb-5" style={{ marginBottom: keyboardInset }}>
          {__DEV__ ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Dev fast bypass auto-fill OTP"
              onPress={handleDevBypass}
              className="h-11 mb-3 rounded-xl bg-ink border border-hairline flex-row items-center justify-center"
              activeOpacity={0.7}
            >
              <Zap size={14} color="#C77DFF" />
              <Text className="text-xs font-semibold text-moonlight ml-2">
                ⚡ Dev Fast Bypass (Auto-fill 123456)
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Verify and Continue"
            className={`h-14 rounded-full flex-row items-center justify-center ${
              isComplete ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
            }`}
            onPress={() => submitOtp(code)}
            disabled={isLoading || !isComplete}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#F5F0FF" />
            ) : (
              <Text
                className={`text-base font-bold font-display ${
                  isComplete ? 'text-moonlight' : 'text-dusk'
                }`}
              >
                Verify & Continue
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
