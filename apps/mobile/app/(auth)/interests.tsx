import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Sparkles,
  Check,
  Flame,
  Coffee,
  Laptop,
  Code2,
  Dice5,
  Dumbbell,
  Zap,
  Activity,
  Wine,
  UserCheck,
  Camera,
  CalendarDays,
  Languages,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { Avatar } from '../../src/components/common/Avatar';
import { pickAvatarImage, uploadAvatarImage, type PickedAvatar } from '../../src/services/avatar';
import {
  BIO_MAX_LENGTH,
  INTEREST_CATEGORIES,
  type InterestId,
  LANGUAGES,
  MAX_PREFERRED_LANGUAGES,
  type LanguageCode,
  USER_GENDERS,
  UserProfileSchema,
} from '@hobbie/shared';

type Gender = (typeof USER_GENDERS)[number];

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  'non-binary': 'Non-binary',
  'prefer-not-to-say': 'Prefer not to say',
};

/** Format a Date as a local-timezone YYYY-MM-DD string (no UTC drift). */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCategoryIcon(id: string, color: string) {
  switch (id) {
    case 'football':
      return <Activity size={18} color={color} />;
    case 'badminton':
      return <Zap size={18} color={color} />;
    case 'table_tennis':
      return <Sparkles size={18} color={color} />;
    case 'gym_fitness':
      return <Dumbbell size={18} color={color} />;
    case 'running':
      return <Flame size={18} color={color} />;
    case 'cafe_coffee':
      return <Coffee size={18} color={color} />;
    case 'coworking':
      return <Laptop size={18} color={color} />;
    case 'coding_tech':
      return <Code2 size={18} color={color} />;
    case 'board_games':
      return <Dice5 size={18} color={color} />;
    case 'nightlife':
      return <Wine size={18} color={color} />;
    default:
      return <Sparkles size={18} color={color} />;
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text className="text-xs text-ember font-medium mt-2 ml-1">{message}</Text>;
}

function SelectableChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      activeOpacity={0.7}
      className={`min-h-[44px] px-4 py-2.5 rounded-2xl border flex-row items-center justify-center ${
        selected ? 'bg-signal-violet/20 border-signal-violet' : 'bg-ink border-hairline'
      }`}
    >
      {children}
      <Text
        className={`text-xs font-bold font-display ${
          children ? 'ml-2' : ''
        } ${selected ? 'text-moonlight' : 'text-dusk'}`}
      >
        {label}
      </Text>
      {selected ? (
        <View className="w-4 h-4 rounded-full bg-signal-violet items-center justify-center ml-2">
          <Check size={10} color="#F5F0FF" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { upsertProfile, isLoading, user } = useAuthStore(
    useShallow((s) => ({
      upsertProfile: s.upsertProfile,
      isLoading: s.isLoading,
      user: s.user,
    }))
  );

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState<Date>(() => new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>(['football']);
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>([]);
  const [pendingAvatar, setPendingAvatar] = useState<PickedAvatar | null>(null);
  const [avatarError, setAvatarError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
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

  const checks = useMemo(() => {
    const nameCheck = UserProfileSchema.shape.name.safeParse(name.trim());
    const birthCheck = UserProfileSchema.shape.birthDate.safeParse(toIsoDate(birthDate));
    const languagesCheck =
      UserProfileSchema.shape.preferredLanguages.safeParse(selectedLanguages);
    const interestsCheck = UserProfileSchema.shape.interests.safeParse(selectedInterests);
    const bioCheck = UserProfileSchema.shape.bio.safeParse(bio.trim() || undefined);

    const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
      result.success ? undefined : result.error?.issues[0]?.message;

    return {
      name: firstError(nameCheck),
      birthDate: firstError(birthCheck),
      languages: firstError(languagesCheck),
      interests: firstError(interestsCheck),
      bio: firstError(bioCheck),
    };
  }, [name, birthDate, selectedLanguages, selectedInterests, bio]);

  const isValid = !Object.values(checks).some(Boolean);
  const showError = (field: keyof typeof checks) =>
    Boolean((touched[field] || submitted) && checks[field]);

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const toggleInterest = (id: InterestId) => {
    setErrorMsg('');
    setSelectedInterests((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((i) => i !== id);
      }
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  const toggleLanguage = (code: LanguageCode) => {
    setErrorMsg('');
    setSelectedLanguages((current) => {
      if (current.includes(code)) return current.filter((c) => c !== code);
      if (current.length >= MAX_PREFERRED_LANGUAGES) return current;
      return [...current, code];
    });
  };

  const handlePickAvatar = async () => {
    setAvatarError('');
    const result = await pickAvatarImage();
    if (result.error) {
      setAvatarError(result.error);
      return;
    }
    if (result.image) setPendingAvatar(result.image);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setErrorMsg('');

    if (!isValid) {
      setErrorMsg('Please fix the highlighted fields before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      let avatarUrl: string | undefined;

      if (pendingAvatar) {
        if (!user?.id) {
          setErrorMsg('Session expired. Please sign in again.');
          return;
        }
        const uploaded = await uploadAvatarImage({ userId: user.id, image: pendingAvatar });
        if (uploaded.error || !uploaded.url) {
          setErrorMsg(uploaded.error ?? 'Could not upload your photo. Try again.');
          return;
        }
        avatarUrl = uploaded.url;
      }

      const res = await upsertProfile({
        name: name.trim(),
        birthDate: toIsoDate(birthDate),
        gender,
        interests: selectedInterests,
        preferredLanguages: selectedLanguages,
        bio: bio.trim() || undefined,
        avatarUrl,
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

  const busy = isSubmitting || isLoading;
  const previewUri = pendingAvatar?.uri ?? null;

  return (
    <KeyboardAvoidingView
      accessible={false}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
        className="flex-1"
      >
        {/* Header */}
        <View className="mb-7">
          <View className="flex-row items-center gap-2 mb-2">
            <UserCheck size={20} color="#C77DFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac">
              Profile Setup
            </Text>
          </View>
          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
            Build your identity
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            Add a photo, tell squads who you are and pick the activities you want on your radar.
          </Text>
        </View>

        {/* Avatar */}
        <View className="items-center mb-8">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add or change profile photo"
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            className="relative"
          >
            <Avatar name={name.trim()} url={previewUri} size={96} className="border border-hairline" />
            <View className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-signal-violet items-center justify-center border-2 border-void">
              <Camera size={15} color="#F5F0FF" />
            </View>
          </TouchableOpacity>
          <Text className="text-xs text-dusk mt-3">
            {previewUri ? 'Tap to change your photo' : 'Add a photo (optional)'}
          </Text>
          {previewUri ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
              onPress={() => setPendingAvatar(null)}
              className="mt-1.5"
            >
              <Text className="text-2xs text-ember font-semibold">Remove photo</Text>
            </TouchableOpacity>
          ) : null}
          {avatarError ? (
            <Text className="text-xs text-ember font-medium mt-2 text-center">{avatarError}</Text>
          ) : null}
        </View>

        {/* Display name */}
        <View className="mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2 ml-1">
            Display Name
          </Text>
          <TextInput
            className={`h-14 bg-ink rounded-2xl border px-4 text-base text-moonlight font-medium ${
              showError('name') ? 'border-ember' : 'border-hairline'
            }`}
            placeholder="e.g. Alex Rivera"
            placeholderTextColor="#5A536B"
            value={name}
            maxLength={50}
            autoCapitalize="words"
            returnKeyType="next"
            onChangeText={(text) => {
              setName(text);
              if (errorMsg) setErrorMsg('');
            }}
            onBlur={() => markTouched('name')}
          />
          <FieldError message={showError('name') ? checks.name : undefined} />
        </View>

        {/* Birth date */}
        <View className="mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2 ml-1">
            Birth Date (Must be 18+)
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Select your birth date"
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            className={`h-14 bg-ink rounded-2xl border px-4 flex-row items-center justify-between ${
              showError('birthDate') ? 'border-ember' : 'border-hairline'
            }`}
          >
            <Text className="text-base text-moonlight font-medium">
              {formatDisplayDate(birthDate)}
            </Text>
            <CalendarDays size={18} color="#A99BC2" />
          </TouchableOpacity>
          <FieldError message={showError('birthDate') ? checks.birthDate : undefined} />
        </View>

        {/* Gender */}
        <View className="mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2 ml-1">
            Gender (For filtered squads)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {USER_GENDERS.map((option) => (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                accessibilityLabel={GENDER_LABELS[option]}
                accessibilityState={{ selected: gender === option }}
                onPress={() => setGender(option)}
                activeOpacity={0.7}
                className={`min-h-[44px] px-4 py-2.5 rounded-full border justify-center items-center ${
                  gender === option
                    ? 'bg-signal-violet/20 border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    gender === option ? 'text-pulse-lilac' : 'text-dusk'
                  }`}
                >
                  {GENDER_LABELS[option]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bio */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-dusk ml-1">
              Bio (Optional)
            </Text>
            <Text className="text-2xs font-mono text-dusk">
              {bio.length}/{BIO_MAX_LENGTH}
            </Text>
          </View>
          <TextInput
            className={`min-h-[96px] bg-ink rounded-2xl border px-4 py-3 text-base text-moonlight ${
              showError('bio') ? 'border-ember' : 'border-hairline'
            }`}
            placeholder="A short line about you and the squads you enjoy."
            placeholderTextColor="#5A536B"
            value={bio}
            maxLength={BIO_MAX_LENGTH}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            onChangeText={(text) => {
              setBio(text);
              if (errorMsg) setErrorMsg('');
            }}
            onBlur={() => markTouched('bio')}
          />
          <FieldError message={showError('bio') ? checks.bio : undefined} />
        </View>

        {/* Preferred languages */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2 ml-1">
              <Languages size={14} color="#A99BC2" />
              <Text className="text-xs font-semibold uppercase tracking-wider text-dusk">
                Preferred Languages
              </Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-ink-raised border border-hairline">
              <Text className="text-2xs font-mono font-bold text-pulse-lilac">
                {selectedLanguages.length}/{MAX_PREFERRED_LANGUAGES}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {LANGUAGES.map((language) => {
              const isSelected = selectedLanguages.includes(language.code);
              return (
                <SelectableChip
                  key={language.code}
                  label={language.label}
                  selected={isSelected}
                  accessibilityLabel={`Preferred language ${language.label}`}
                  onPress={() => toggleLanguage(language.code)}
                />
              );
            })}
          </View>
          <FieldError message={showError('languages') ? checks.languages : undefined} />
        </View>

        {/* Interests */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-dusk ml-1">
              Hobby Taxonomy
            </Text>
            <View className="px-2.5 py-1 rounded-full bg-ink-raised border border-hairline">
              <Text className="text-2xs font-mono font-bold text-pulse-lilac">
                {selectedInterests.length}/5
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2.5">
            {INTEREST_CATEGORIES.map((category) => {
              const isSelected = selectedInterests.includes(category.id);
              return (
                <SelectableChip
                  key={category.id}
                  label={category.label}
                  selected={isSelected}
                  accessibilityLabel={`Hobby ${category.label}`}
                  onPress={() => toggleInterest(category.id)}
                >
                  {getCategoryIcon(category.id, isSelected ? '#C77DFF' : '#A99BC2')}
                </SelectableChip>
              );
            })}
          </View>
          <FieldError message={showError('interests') ? checks.interests : undefined} />
        </View>

        {errorMsg ? (
          <Text className="text-xs text-ember font-medium text-center mb-4" selectable>
            {errorMsg}
          </Text>
        ) : null}

        {/* CTA */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Enter Hobbie"
          onPress={handleSubmit}
          disabled={busy}
          activeOpacity={0.85}
          className={`h-14 rounded-full flex-row items-center justify-center ${
            isValid ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
          }`}
        >
          {busy ? (
            <ActivityIndicator color="#F5F0FF" />
          ) : (
            <Text
              className={`text-base font-bold font-display ${
                isValid ? 'text-moonlight' : 'text-dusk'
              }`}
            >
              Enter Hobbie
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Native date picker: iOS shows a bottom sheet wheel, Android a dialog. */}
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
                  onPress={() => {
                    markTouched('birthDate');
                    setShowDatePicker(false);
                  }}
                  className="min-h-[40px] px-4 rounded-full bg-signal-violet items-center justify-center"
                >
                  <Text className="text-xs font-bold text-moonlight">Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={birthDate}
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
          value={birthDate}
          mode="date"
          display="default"
          minimumDate={minBirthDate}
          maximumDate={maxBirthDate}
          onValueChange={(_event, date) => {
            setBirthDate(date);
            markTouched('birthDate');
            setShowDatePicker(false);
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
