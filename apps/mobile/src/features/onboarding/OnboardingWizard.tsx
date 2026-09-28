import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarDays, Check } from 'lucide-react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useShallow } from 'zustand/react/shallow';
import {
  INTEREST_CATEGORIES,
  type InterestId,
  USER_GENDERS,
  UserProfileSchema,
} from '@hobbie/shared';
import { useAuthStore } from '../auth/useAuthStore';
import { PhotoGrid } from '../profile/PhotoGrid';
import { GENDER_LABELS, getInterestIcon, type Gender } from '../profile/profileMeta';
import { OnboardingShell } from './OnboardingShell';

const STEP_COUNT = 5;
const MIN_PHOTOS = 1;

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function OnboardingWizard() {
  const router = useRouter();
  const { upsertProfile, user } = useAuthStore(
    useShallow((s) => ({
      upsertProfile: s.upsertProfile,
      user: s.user,
    }))
  );

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [interests, setInterests] = useState<InterestId[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxBirthDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  }, []);
  const minBirthDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  }, []);

  const nameValid = UserProfileSchema.shape.name.safeParse(name.trim()).success;
  const birthValid =
    birthDate !== null && UserProfileSchema.shape.birthDate.safeParse(toIsoDate(birthDate)).success;
  const interestsValid = UserProfileSchema.shape.interests.safeParse(interests).success;

  const clearError = () => {
    if (errorMsg) setErrorMsg('');
  };

  const toggleInterest = (id: InterestId) => {
    clearError();
    setInterests((current) => {
      if (current.includes(id)) return current.filter((i) => i !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  const handleSubmit = async () => {
    if (!birthDate || !gender || !interestsValid) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await upsertProfile({
        name: name.trim(),
        birthDate: toIsoDate(birthDate),
        gender,
        interests,
        // Onboarding is English-first; the full language picker lives in
        // post-onboarding profile editing.
        preferredLanguages: ['en'],
        avatarUrl: photos[0],
        photoUrls: photos,
      });
      if (res.error) {
        setErrorMsg(res.error);
        return;
      }
      router.replace('/(main)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    clearError();
    setStep((s) => Math.max(0, s - 1));
  };

  return (
    <>
      {step === 0 ? (
        <OnboardingShell
          stepIndex={0}
          stepCount={STEP_COUNT}
          title="Add your recent pics"
          subtitle="Your first photo is your cover. Profiles with photos get far more requests."
          ctaLabel="Next"
          ctaDisabled={photos.length < MIN_PHOTOS}
          onCta={() => {
            clearError();
            setStep(1);
          }}
          error={errorMsg}
        >
          <PhotoGrid
            userId={user?.id}
            photos={photos}
            onChange={(next) => {
              clearError();
              setPhotos(next);
            }}
            minRequired={MIN_PHOTOS}
            onError={setErrorMsg}
          />
        </OnboardingShell>
      ) : null}

      {step === 1 ? (
        <OnboardingShell
          stepIndex={1}
          stepCount={STEP_COUNT}
          title="What’s your first name?"
          ctaLabel="Next"
          ctaDisabled={!nameValid}
          onCta={() => {
            clearError();
            setStep(2);
          }}
          onBack={goBack}
          error={errorMsg}
        >
          <TextInput
            className="h-14 bg-ink rounded-2xl border border-hairline px-4 text-base text-moonlight font-medium"
            placeholder="Enter first name"
            placeholderTextColor="#5A536B"
            value={name}
            maxLength={50}
            autoCapitalize="words"
            returnKeyType="done"
            onChangeText={(text) => {
              setName(text);
              clearError();
            }}
          />
          <Text className="text-xs text-dusk mt-3 ml-1">
            This is how it’ll appear on your profile.
          </Text>
        </OnboardingShell>
      ) : null}

      {step === 2 ? (
        <OnboardingShell
          stepIndex={2}
          stepCount={STEP_COUNT}
          title="Your b-day?"
          ctaLabel="Next"
          ctaDisabled={!birthValid}
          onCta={() => {
            clearError();
            setStep(3);
          }}
          onBack={goBack}
          error={errorMsg}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Select your birth date"
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            className="h-14 bg-ink rounded-2xl border border-hairline px-4 flex-row items-center justify-between"
          >
            <Text
              className={`text-base font-medium ${
                birthDate ? 'text-moonlight' : 'text-dusk'
              }`}
            >
              {birthDate ? formatDisplayDate(birthDate) : 'DD / MM / YYYY'}
            </Text>
            <CalendarDays size={18} color="#A99BC2" />
          </TouchableOpacity>
          <Text className="text-xs text-dusk mt-3 ml-1">
            Your profile shows your age, not your date of birth.
          </Text>
        </OnboardingShell>
      ) : null}

      {step === 3 ? (
        <OnboardingShell
          stepIndex={3}
          stepCount={STEP_COUNT}
          title="What’s your gender?"
          ctaLabel="Next"
          ctaDisabled={gender === null}
          onCta={() => {
            clearError();
            setStep(4);
          }}
          onBack={goBack}
          error={errorMsg}
        >
          <View className="gap-3">
            {USER_GENDERS.map((option) => {
              const selected = gender === option;
              return (
                <TouchableOpacity
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={GENDER_LABELS[option]}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    clearError();
                    setGender(option);
                  }}
                  activeOpacity={0.7}
                  className={`h-14 rounded-full border px-5 flex-row items-center justify-between ${
                    selected ? 'bg-signal-violet/20 border-signal-violet' : 'bg-ink border-hairline'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? 'text-moonlight' : 'text-dusk'
                    }`}
                  >
                    {GENDER_LABELS[option]}
                  </Text>
                  {selected ? (
                    <View className="w-5 h-5 rounded-full bg-signal-violet items-center justify-center">
                      <Check size={12} color="#F5F0FF" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-xs text-dusk mt-3 ml-1">
            Used to respect gender filters on squads.
          </Text>
        </OnboardingShell>
      ) : null}

      {step === 4 ? (
        <OnboardingShell
          stepIndex={4}
          stepCount={STEP_COUNT}
          title="What are you into?"
          subtitle="Pick up to 5 activities you want on your radar."
          ctaLabel="Enter Hobbie"
          ctaDisabled={!interestsValid}
          ctaBusy={isSubmitting}
          onCta={handleSubmit}
          onBack={goBack}
          error={errorMsg}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-dusk ml-1">
              Activities
            </Text>
            <View className="px-2.5 py-1 rounded-full bg-ink-raised border border-hairline">
              <Text className="text-2xs font-mono font-bold text-pulse-lilac">
                {interests.length}/5
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2.5">
            {INTEREST_CATEGORIES.map((category) => {
              const selected = interests.includes(category.id);
              return (
                <TouchableOpacity
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Hobby ${category.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => toggleInterest(category.id)}
                  activeOpacity={0.7}
                  className={`min-h-[44px] px-4 py-2.5 rounded-2xl border flex-row items-center ${
                    selected ? 'bg-signal-violet/20 border-signal-violet' : 'bg-ink border-hairline'
                  }`}
                >
                  {getInterestIcon(category.id, selected ? '#C77DFF' : '#A99BC2')}
                  <Text
                    className={`text-xs font-bold font-display ml-2 ${
                      selected ? 'text-moonlight' : 'text-dusk'
                    }`}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </OnboardingShell>
      ) : null}

      {/* Native date picker: iOS bottom-sheet wheel, Android dialog. */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-end"
            onPress={() => setShowDatePicker(false)}
          >
            <Pressable
              className="bg-ink rounded-t-3xl border-t border-hairline px-5 pt-5 pb-8"
              onPress={(event) => event.stopPropagation()}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-bold font-display text-moonlight">
                  Select birth date
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Confirm birth date"
                  onPress={() => setShowDatePicker(false)}
                  className="min-h-[40px] px-4 rounded-full bg-signal-violet items-center justify-center"
                >
                  <Text className="text-xs font-bold text-moonlight">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={birthDate ?? new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                minimumDate={minBirthDate}
                maximumDate={maxBirthDate}
                accentColor="#7B2FF7"
                themeVariant="dark"
                onValueChange={(_event, date) => setBirthDate(date)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : showDatePicker ? (
        <DateTimePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          mode="date"
          display="default"
          minimumDate={minBirthDate}
          maximumDate={maxBirthDate}
          onValueChange={(_event, date) => {
            setBirthDate(date);
            setShowDatePicker(false);
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      ) : null}
    </>
  );
}
