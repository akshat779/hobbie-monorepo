import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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
  ChevronLeft,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { INTEREST_CATEGORIES, InterestId } from '@hobbie/shared';

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'non-binary', label: 'Non-binary' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export default function ProfileAndInterestsScreen() {
  const router = useRouter();
  const { upsertProfile, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('2000-01-01');
  const [gender, setGender] = useState<'male' | 'female' | 'non-binary' | 'prefer-not-to-say'>('male');
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>(['football']);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleInterest = (id: InterestId) => {
    setErrorMsg('');
    if (selectedInterests.includes(id)) {
      if (selectedInterests.length === 1) {
        setErrorMsg('Select at least 1 interest.');
        return;
      }
      setSelectedInterests(selectedInterests.filter((i) => i !== id));
    } else {
      if (selectedInterests.length >= 5) {
        setErrorMsg('Maximum 5 interests allowed.');
        return;
      }
      setSelectedInterests([...selectedInterests, id]);
    }
  };

  const handleSubmit = async () => {
    setErrorMsg('');

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your name (min 2 characters).');
      return;
    }

    if (selectedInterests.length === 0) {
      setErrorMsg('Please select at least 1 interest.');
      return;
    }

    const res = await upsertProfile({
      name: name.trim(),
      birthDate,
      gender,
      interests: selectedInterests,
    });

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    router.replace('/(main)');
  };

  const getCategoryIcon = (id: string, color: string) => {
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
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 px-6 pt-2 pb-6"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-4">
        {/* Header */}
        <View className="mb-6">
          <View className="flex-row items-center space-x-2 mb-2">
            <UserCheck size={20} color="#C77DFF" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-pulse-lilac ml-1.5">
              Profile Setup
            </Text>
          </View>
          <Text className="text-3xl font-extrabold font-display text-moonlight tracking-tight mb-1">
            Build your identity
          </Text>
          <Text className="text-sm text-dusk leading-relaxed">
            Tell squads who you are and select the activities you want on your radar.
          </Text>
        </View>

        {/* Name Input */}
        <View className="mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2">
            Display Name
          </Text>
          <TextInput
            className="h-14 bg-ink rounded-2xl border border-hairline px-4 text-base text-moonlight font-medium focus:border-signal-violet"
            placeholder="e.g. Alex Rivera"
            placeholderTextColor="#5A536B"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Date of Birth */}
        <View className="mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2">
            Birth Date (Must be 18+)
          </Text>
          <TextInput
            className="h-14 bg-ink rounded-2xl border border-hairline px-4 text-base font-mono text-moonlight font-medium focus:border-signal-violet"
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#5A536B"
            value={birthDate}
            onChangeText={setBirthDate}
          />
        </View>

        {/* Gender Selection */}
        <View className="mb-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-dusk mb-2">
            Gender (For filtered squads)
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENDER_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => setGender(g.id)}
                className={`px-4 py-2.5 rounded-full border ${
                  gender === g.id
                    ? 'bg-signal-violet/20 border-signal-violet'
                    : 'bg-ink border-hairline'
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-semibold ${
                    gender === g.id ? 'text-pulse-lilac' : 'text-dusk'
                  }`}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interest Selection Grid */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-dusk">
              Hobby Taxonomy
            </Text>
            <View className="px-2.5 py-1 rounded-full bg-ink-raised border border-hairline">
              <Text className="text-xs font-mono font-bold text-pulse-lilac">
                {selectedInterests.length}/5 Selected
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2.5">
            {INTEREST_CATEGORIES.map((cat) => {
              const isSelected = selectedInterests.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => toggleInterest(cat.id)}
                  className={`px-4 py-3 rounded-2xl border flex-row items-center ${
                    isSelected
                      ? 'bg-signal-violet/20 border-signal-violet'
                      : 'bg-ink border-hairline'
                  }`}
                  activeOpacity={0.7}
                >
                  {getCategoryIcon(cat.id, isSelected ? '#C77DFF' : '#A99BC2')}
                  <Text
                    className={`text-xs font-bold font-display ml-2 ${
                      isSelected ? 'text-moonlight' : 'text-dusk'
                    }`}
                  >
                    {cat.label}
                  </Text>
                  {isSelected && (
                    <View className="w-4 h-4 rounded-full bg-signal-violet items-center justify-center ml-2">
                      <Check size={10} color="#F5F0FF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {errorMsg ? (
          <Text className="text-xs text-ember font-medium text-center mb-4">{errorMsg}</Text>
        ) : null}

        {/* CTA Button */}
        <TouchableOpacity
          className={`h-14 mb-8 rounded-full flex-row items-center justify-center ${
            name.trim().length >= 2 && selectedInterests.length > 0
              ? 'bg-signal-violet'
              : 'bg-ink-raised border border-hairline'
          }`}
          onPress={handleSubmit}
          disabled={isLoading || name.trim().length < 2 || selectedInterests.length === 0}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#F5F0FF" />
          ) : (
            <Text
              className={`text-base font-bold font-display ${
                name.trim().length >= 2 && selectedInterests.length > 0
                  ? 'text-moonlight'
                  : 'text-dusk'
              }`}
            >
              Enter Hobbie
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
