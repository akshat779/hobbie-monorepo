import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';

export interface OnboardingShellProps {
  /** 0-based index of the current step. */
  stepIndex: number;
  stepCount: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  ctaLabel: string;
  ctaDisabled: boolean;
  ctaBusy?: boolean;
  onCta: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  error?: string;
}

/**
 * Shared chrome for every onboarding step: a top progress bar, a back/Skip
 * header, top-anchored single-question content, and a bottom-pinned CTA in the
 * same position on every screen.
 */
export function OnboardingShell({
  stepIndex,
  stepCount,
  title,
  subtitle,
  children,
  ctaLabel,
  ctaDisabled,
  ctaBusy = false,
  onCta,
  onBack,
  onSkip,
  error,
}: OnboardingShellProps) {
  const progress = Math.round(((stepIndex + 1) / stepCount) * 100);
  const keyboardInset = useKeyboardInset();

  return (
    <View className="flex-1 bg-void">
      {/* Full-bleed progress bar */}
      <View className="h-1 bg-ink-raised">
        <View className="h-1 bg-signal-violet" style={{ width: `${progress}%` }} />
      </View>

      <View className="flex-row items-center justify-between px-4 pt-2">
        {onBack ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-10 h-10 items-center justify-center"
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color="#F5F0FF" />
          </TouchableOpacity>
        ) : (
          <View className="w-10 h-10" />
        )}

        {onSkip ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
            onPress={onSkip}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="min-h-[40px] px-3 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="text-sm font-semibold text-dusk">Skip</Text>
          </TouchableOpacity>
        ) : (
          <View className="w-10 h-10" />
        )}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}
      >
        <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-2">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-dusk leading-relaxed mb-1">{subtitle}</Text>
        ) : null}

        <View className="mt-6">{children}</View>
      </ScrollView>

      {/* Bottom-pinned CTA that lifts above the keypad (iOS), so a step with a
          text field (e.g. Name) never hides the primary action. */}
      <View className="px-6 pb-5" style={{ marginBottom: keyboardInset }}>
        {error ? (
          <Text className="text-xs text-ember font-medium text-center mb-3" selectable>
            {error}
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          onPress={onCta}
          disabled={ctaDisabled || ctaBusy}
          activeOpacity={0.85}
          className={`h-14 rounded-full flex-row items-center justify-center ${
            ctaDisabled ? 'bg-ink-raised border border-hairline' : 'bg-signal-violet'
          }`}
        >
          {ctaBusy ? (
            <ActivityIndicator color="#F5F0FF" />
          ) : (
            <Text
              className={`text-base font-bold font-display ${
                ctaDisabled ? 'text-dusk' : 'text-moonlight'
              }`}
            >
              {ctaLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
