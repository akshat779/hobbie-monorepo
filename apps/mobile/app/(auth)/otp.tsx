import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, RotateCcw, ShieldCheck, Zap } from 'lucide-react-native';
import { useAuthStore } from '../../src/features/auth/useAuthStore';

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone || '+91 98765 43210';

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { verifyOtp, signInWithPhone, isLoading } = useAuthStore();

  useEffect(() => {
    if (timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const handleDigitChange = (value: string, index: number) => {
    setErrorMsg('');
    const cleanVal = value.replace(/\D/g, '');

    // Handle full paste
    if (cleanVal.length > 1) {
      const pasted = cleanVal.slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((d, i) => {
        newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      if (pasted.length === 6) {
        submitOtp(newDigits.join(''));
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
      return;
    }

    const updated = [...otpDigits];
    updated[index] = cleanVal;
    setOtpDigits(updated);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit if all 6 digits entered
    if (cleanVal && index === 5) {
      const fullOtp = updated.join('');
      if (fullOtp.length === 6) {
        submitOtp(fullOtp);
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    setErrorMsg('');
    const res = await verifyOtp(phone, code);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    if (res.hasProfile) {
      router.replace('/(main)');
    } else {
      router.replace('/(auth)/interests');
    }
  };

  const handleResendOtp = async () => {
    if (timerSeconds > 0) return;
    setTimerSeconds(60);
    setErrorMsg('');
    await signInWithPhone(phone);
  };

  const handleDevBypass = () => {
    setOtpDigits(['1', '2', '3', '4', '5', '6']);
    submitOtp('123456');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-between px-6 py-6"
      >
        {/* Top Bar */}
        <View className="pt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center mb-6"
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#F5F0FF" />
          </TouchableOpacity>

          <View className="flex-row items-center space-x-2 mb-2">
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
        </View>

        {/* 6 Digit Inputs */}
        <View className="my-auto py-4">
          <View className="flex-row justify-between mb-4">
            {otpDigits.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => {
                  inputRefs.current[idx] = ref;
                }}
                className={`w-12 h-14 bg-ink rounded-2xl border text-center text-xl font-bold font-mono text-moonlight ${
                  digit
                    ? 'border-signal-violet bg-ink-raised'
                    : 'border-hairline focus:border-signal-violet'
                }`}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(val) => handleDigitChange(val, idx)}
                onKeyPress={(e) => handleKeyPress(e, idx)}
                autoFocus={idx === 0}
                textContentType="oneTimeCode"
              />
            ))}
          </View>

          {errorMsg ? (
            <Text className="text-xs text-ember font-medium text-center mb-4">{errorMsg}</Text>
          ) : null}

          {/* Resend Timer & Button */}
          <View className="flex-row items-center justify-center mt-2">
            {timerSeconds > 0 ? (
              <Text className="text-xs text-dusk font-mono">
                Resend code in <Text className="font-bold text-moonlight">{timerSeconds}s</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendOtp}
                className="flex-row items-center py-1.5 px-3 rounded-full bg-ink border border-hairline"
              >
                <RotateCcw size={12} color="#C77DFF" />
                <Text className="text-xs font-semibold text-pulse-lilac ml-1.5">Resend SMS</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            className={`h-14 mt-8 rounded-full flex-row items-center justify-center ${
              otpDigits.every((d) => d !== '')
                ? 'bg-signal-violet'
                : 'bg-ink-raised border border-hairline'
            }`}
            onPress={() => submitOtp(otpDigits.join(''))}
            disabled={isLoading || otpDigits.some((d) => d === '')}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#F5F0FF" />
            ) : (
              <Text
                className={`text-base font-bold font-display ${
                  otpDigits.every((d) => d !== '') ? 'text-moonlight' : 'text-dusk'
                }`}
              >
                Verify & Continue
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Dev Bypass Button (Compiled out in production) */}
        {__DEV__ && (
          <View className="pt-4 border-t border-hairline/60">
            <TouchableOpacity
              onPress={handleDevBypass}
              className="h-11 rounded-xl bg-ink border border-hairline flex-row items-center justify-center"
              activeOpacity={0.7}
            >
              <Zap size={14} color="#C77DFF" />
              <Text className="text-xs font-semibold text-moonlight ml-2">
                ⚡ Dev Fast Bypass (Auto-fill 123456)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
