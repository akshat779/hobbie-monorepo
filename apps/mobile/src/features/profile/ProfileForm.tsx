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
import {
  ChevronLeft,
  Camera,
  CalendarDays,
  Languages,
  Check,
} from 'lucide-react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Avatar } from '../../components/common/Avatar';
import { pickAvatarImage, uploadAvatarImage, type PickedAvatar } from '../../services/avatar';
import {
  BIO_MAX_LENGTH,
  INTEREST_CATEGORIES,
  type InterestId,
  LANGUAGES,
  MAX_PREFERRED_LANGUAGES,
  type LanguageCode,
  USER_GENDERS,
  UserProfileSchema,
  type UserProfileInput,
} from '@hobbie/shared';
import { GENDER_LABELS, getInterestIcon, type Gender } from './profileMeta';

export interface ProfileFormValues {
  name?: string;
  bio?: string | null;
  birthDate?: Date | null;
  gender?: Gender;
  interests?: readonly InterestId[];
  preferredLanguages?: readonly LanguageCode[];
  avatarUrl?: string | null;
}

export interface ProfileFormProps {
  /** Header block rendered at the top of the scrollable form. */
  header: React.ReactNode;
  /** Label for the primary submit button (e.g. "Enter Hobbie"). */
  submitLabel: string;
  /** Authenticated user id, required only when a new photo is picked. */
  userId?: string;
  /** Existing profile values to prefill the form for editing. */
  initialValues?: ProfileFormValues;
  onSubmit: (input: UserProfileInput) => Promise<{ error?: string }>;
  onSuccess: () => void;
  /** When provided, renders a fixed back affordance above the form. */
  onBack?: () => void;
  /**
   * Where the primary submit control lives. `bottom` (default) keeps the CTA at
   * the end of the scroll content; `top` pins it to a fixed bar so it is always
   * reachable without scrolling (used by the edit screen).
   */
  submitPlacement?: 'bottom' | 'top';
}

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
        className={`text-xs font-bold font-display ${children ? 'ml-2' : ''} ${
          selected ? 'text-moonlight' : 'text-dusk'
        }`}
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

/**
 * Single source of truth for creating and editing a profile. Owns field state,
 * Zod validation, avatar picking/uploading, and the native date picker; callers
 * provide the header, submit wiring, and navigation on success.
 */
export function ProfileForm({
  header,
  submitLabel,
  userId,
  initialValues,
  onSubmit,
  onSuccess,
  onBack,
  submitPlacement = 'bottom',
}: ProfileFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [bio, setBio] = useState(initialValues?.bio ?? '');
  const [birthDate, setBirthDate] = useState<Date>(
    () => initialValues?.birthDate ?? new Date(2000, 0, 1)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender>(initialValues?.gender ?? 'male');
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>(() =>
    initialValues?.interests?.length ? [...initialValues.interests] : ['football']
  );
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(() =>
    initialValues?.preferredLanguages ? [...initialValues.preferredLanguages] : []
  );
  const [pendingAvatar, setPendingAvatar] = useState<PickedAvatar | null>(null);
  const [existingAvatarUrl] = useState<string | null>(initialValues?.avatarUrl ?? null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
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

  const displayedAvatarUrl = pendingAvatar?.uri ?? (avatarRemoved ? null : existingAvatarUrl);

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
    if (result.image) {
      setPendingAvatar(result.image);
      setAvatarRemoved(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarError('');
    if (pendingAvatar) {
      setPendingAvatar(null);
      return;
    }
    setAvatarRemoved(true);
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
        if (!userId) {
          setErrorMsg('Session expired. Please sign in again.');
          return;
        }
        const uploaded = await uploadAvatarImage({ userId, image: pendingAvatar });
        if (uploaded.error || !uploaded.url) {
          setErrorMsg(uploaded.error ?? 'Could not upload your photo. Try again.');
          return;
        }
        avatarUrl = uploaded.url;
      } else if (avatarRemoved) {
        // Explicitly clear the stored photo.
        avatarUrl = undefined;
      } else if (existingAvatarUrl) {
        // Preserve the existing photo when the user only edits other fields.
        avatarUrl = existingAvatarUrl;
      }

      const res = await onSubmit({
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

      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      accessible={false}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-void"
    >
      {onBack || submitPlacement === 'top' ? (
        <View className="flex-row items-center justify-between px-4 pt-1 pb-1">
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

          {submitPlacement === 'top' ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
              className={`min-h-[40px] px-5 rounded-full border flex-row items-center justify-center ${
                isValid
                  ? 'bg-signal-violet border-signal-violet-light/30'
                  : 'bg-ink-raised border-hairline'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#F5F0FF" />
              ) : (
                <Text
                  className={`text-xs font-bold font-display ${
                    isValid ? 'text-moonlight' : 'text-dusk'
                  }`}
                >
                  {submitLabel}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
        className="flex-1"
      >
        {header}

        {/* Avatar */}
        <View className="items-center mb-8">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add or change profile photo"
            onPress={handlePickAvatar}
            activeOpacity={0.85}
            className="relative"
          >
            <Avatar
              name={name.trim()}
              url={displayedAvatarUrl}
              size={96}
              className="border border-hairline"
            />
            <View className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-signal-violet items-center justify-center border-2 border-void">
              <Camera size={15} color="#F5F0FF" />
            </View>
          </TouchableOpacity>
          <Text className="text-xs text-dusk mt-3">
            {displayedAvatarUrl ? 'Tap to change your photo' : 'Add a photo (optional)'}
          </Text>
          {displayedAvatarUrl ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
              onPress={handleRemoveAvatar}
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
                  {getInterestIcon(category.id, isSelected ? '#C77DFF' : '#A99BC2')}
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
        {submitPlacement === 'bottom' ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
            className={`h-14 rounded-full flex-row items-center justify-center ${
              isValid ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
            }`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#F5F0FF" />
            ) : (
              <Text
                className={`text-base font-bold font-display ${
                  isValid ? 'text-moonlight' : 'text-dusk'
                }`}
              >
                {submitLabel}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
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
