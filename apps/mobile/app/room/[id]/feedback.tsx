import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Shield,
  ArrowLeft,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/features/auth/useAuthStore';
import {
  useRoomMetadataQuery,
  useRoomMembersQuery,
} from '../../../src/features/room/useRoomQuery';
import {
  useSubmitFeedbackMutation,
} from '../../../src/features/feedback/useFeedbackMutations';
import { calculateFeedbackScore } from '../../../src/services/feedback';

const AVAILABLE_TAGS = [
  'Friendly',
  'On Time',
  'Great Host',
  'Good Communicator',
  'High Energy',
  'Respectful',
];

export default function PostActivityFeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: roomMeta } = useRoomMetadataQuery(id);
  const { data: allMembers = [], isLoading: isMembersLoading } = useRoomMembersQuery(id);
  const submitMutation = useSubmitFeedbackMutation(id || '', currentUserId || '');

  // Peers to review (excluding current user)
  const peersToReview = useMemo(
    () => allMembers.filter((m) => m.id !== currentUserId),
    [allMembers, currentUserId]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hangOutAgain, setHangOutAgain] = useState<boolean | null>(null);
  const [asDescribed, setAsDescribed] = useState<boolean | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [keepInTouch, setKeepInTouch] = useState(false);
  const [mutualMatchUser, setMutualMatchUser] = useState<string | null>(null);

  const currentPeer = peersToReview[currentIndex];
  const hasMultiple = peersToReview.length > 1;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSkip = () => {
    if (currentIndex < peersToReview.length - 1) {
      // Advance to next peer
      setCurrentIndex((i) => i + 1);
      setHangOutAgain(null);
      setAsDescribed(null);
      setSelectedTags([]);
      setKeepInTouch(false);
    } else {
      router.replace('/(main)/my-activities');
    }
  };

  const handleSubmit = async () => {
    if (!id || !currentPeer) return;
    if (hangOutAgain === null || asDescribed === null) {
      Alert.alert('Incomplete Feedback', 'Please answer the two questions before submitting.');
      return;
    }

    const score = calculateFeedbackScore(hangOutAgain, asDescribed);

    try {
      const res = await submitMutation.mutateAsync({
        activityId: id,
        targetUserId: currentPeer.id,
        score,
        tags: selectedTags,
        keepInTouch,
      });

      if (res.mutualConnection) {
        setMutualMatchUser(currentPeer.name);
        return;
      }

      // Advance or exit
      if (currentIndex < peersToReview.length - 1) {
        setCurrentIndex((i) => i + 1);
        setHangOutAgain(null);
        setAsDescribed(null);
        setSelectedTags([]);
        setKeepInTouch(false);
      } else {
        Alert.alert('Feedback Received', 'Thank you for helping us curate the night!', [
          {
            text: 'Done',
            onPress: () => router.replace('/(main)/my-activities'),
          },
        ]);
      }
    } catch (err) {
      Alert.alert(
        'Submission Error',
        err instanceof Error ? err.message : 'Failed to submit feedback'
      );
    }
  };

  const handleDismissMatch = () => {
    setMutualMatchUser(null);
    if (currentIndex < peersToReview.length - 1) {
      setCurrentIndex((i) => i + 1);
      setHangOutAgain(null);
      setAsDescribed(null);
      setSelectedTags([]);
      setKeepInTouch(false);
    } else {
      router.replace('/(main)/my-activities');
    }
  };

  if (isMembersLoading) {
    return (
      <View className="flex-1 bg-void items-center justify-center">
        <ActivityIndicator size="large" color="#C77DFF" />
      </View>
    );
  }

  // If no peers to review (e.g. user was alone)
  if (!currentPeer) {
    return (
      <View
        style={{ paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom }}
        className="flex-1 bg-void px-6 items-center justify-center text-center"
      >
        <Text className="text-moonlight font-display text-2xl font-bold mb-2">
          No Squad Members to Rate
        </Text>
        <Text className="text-dusk text-sm text-center mb-6">
          There are no other participants to review for this meetup.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(main)/my-activities')}
          className="px-6 py-3 bg-signal-violet rounded-full"
        >
          <Text className="text-void font-bold">Return to My Squads</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom }}
      className="flex-1 bg-void px-5"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to My Squads"
          onPress={() => router.replace('/(main)/my-activities')}
          className="w-9 h-9 rounded-full bg-ink items-center justify-center border border-hairline"
        >
          <ArrowLeft size={16} color="#F5F0FF" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-moonlight font-display font-bold text-xl">Feedback</Text>
          <Text className="text-dusk text-2xs font-mono">Help us curate the night.</Text>
        </View>
        <View className="w-9" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Peer Card / Selector */}
        <View className="bg-ink border border-hairline rounded-3xl p-5 mb-5">
          {hasMultiple && (
            <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-hairline">
              <Text className="text-dusk text-2xs font-mono uppercase tracking-wider">
                Member {currentIndex + 1} of {peersToReview.length}
              </Text>
              <Text className="text-pulse-lilac text-2xs font-bold">
                {peersToReview.length - currentIndex - 1} remaining
              </Text>
            </View>
          )}

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-signal-violet/20 border border-hairline items-center justify-center mr-3">
                <Text className="text-pulse-lilac font-display font-extrabold text-base">
                  {currentPeer.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text className="text-moonlight font-display font-bold text-base">
                  {currentPeer.name}
                </Text>
                <Text className="text-dusk text-2xs font-mono">
                  {currentPeer.isHost ? 'Squad Host' : 'Squad Member'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center bg-void px-2.5 py-1 rounded-full border border-hairline">
              <Shield size={12} color="#C77DFF" style={{ marginRight: 4 }} />
              <Text className="text-moonlight font-mono font-bold text-2xs">
                {currentPeer.trustScore.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Question 1: Hang out again */}
        <View className="bg-ink border border-hairline rounded-3xl p-5 mb-4">
          <Text className="text-moonlight font-display font-bold text-base mb-3">
            Would you hang out with them again?
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thumb up hang out again"
              onPress={() => setHangOutAgain(true)}
              className={`flex-1 py-3.5 rounded-full flex-row items-center justify-center border transition-all active:scale-95 ${
                hangOutAgain === true
                  ? 'bg-ink-raised border-signal-violet'
                  : 'border-hairline bg-void'
              }`}
            >
              <ThumbsUp
                size={18}
                color={hangOutAgain === true ? '#C77DFF' : '#A99BC2'}
                style={{ marginRight: 6 }}
              />
              <Text
                className={`font-display text-sm font-bold ${
                  hangOutAgain === true ? 'text-signal-violet-light' : 'text-dusk'
                }`}
              >
                Yes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thumb down hang out again"
              onPress={() => setHangOutAgain(false)}
              className={`flex-1 py-3.5 rounded-full flex-row items-center justify-center border transition-all active:scale-95 ${
                hangOutAgain === false
                  ? 'bg-ink-raised border-ember'
                  : 'border-hairline bg-void'
              }`}
            >
              <ThumbsDown
                size={18}
                color={hangOutAgain === false ? '#FFB4AB' : '#A99BC2'}
                style={{ marginRight: 6 }}
              />
              <Text
                className={`font-display text-sm font-bold ${
                  hangOutAgain === false ? 'text-ember' : 'text-dusk'
                }`}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Question 2: As advertised */}
        <View className="bg-ink border border-hairline rounded-3xl p-5 mb-4">
          <Text className="text-moonlight font-display font-bold text-base mb-3">
            Were they who they said they'd be?
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thumb up as described"
              onPress={() => setAsDescribed(true)}
              className={`flex-1 py-3.5 rounded-full flex-row items-center justify-center border transition-all active:scale-95 ${
                asDescribed === true
                  ? 'bg-ink-raised border-signal-violet'
                  : 'border-hairline bg-void'
              }`}
            >
              <ThumbsUp
                size={18}
                color={asDescribed === true ? '#C77DFF' : '#A99BC2'}
                style={{ marginRight: 6 }}
              />
              <Text
                className={`font-display text-sm font-bold ${
                  asDescribed === true ? 'text-signal-violet-light' : 'text-dusk'
                }`}
              >
                Yes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Thumb down as described"
              onPress={() => setAsDescribed(false)}
              className={`flex-1 py-3.5 rounded-full flex-row items-center justify-center border transition-all active:scale-95 ${
                asDescribed === false
                  ? 'bg-ink-raised border-ember'
                  : 'border-hairline bg-void'
              }`}
            >
              <ThumbsDown
                size={18}
                color={asDescribed === false ? '#FFB4AB' : '#A99BC2'}
                style={{ marginRight: 6 }}
              />
              <Text
                className={`font-display text-sm font-bold ${
                  asDescribed === false ? 'text-ember' : 'text-dusk'
                }`}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Endorsement Tags */}
        <View className="bg-ink border border-hairline rounded-3xl p-5 mb-4">
          <Text className="text-moonlight font-display font-bold text-base mb-1">
            Endorsements
          </Text>
          <Text className="text-dusk text-2xs mb-3">
            Select traits that describe your experience with {currentPeer.name}.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleToggleTag(tag)}
                  className={`px-3.5 py-2 rounded-full border ${
                    active
                      ? 'bg-signal-violet/20 border-signal-violet'
                      : 'bg-void border-hairline'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      active ? 'text-pulse-lilac font-bold' : 'text-dusk'
                    }`}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reconnect Toggle */}
        <View className="bg-ink border border-hairline rounded-3xl p-5 mb-6">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center mb-1">
                <Sparkles size={16} color="#C77DFF" style={{ marginRight: 6 }} />
                <Text className="text-moonlight font-display font-bold text-base">
                  Keep in touch for {roomMeta?.title || 'Meetups'}?
                </Text>
              </View>
              <Text className="text-dusk text-2xs leading-relaxed">
                Lets you reconnect for this specific activity type only. Kept connections are revealed only when mutual.
              </Text>
            </View>
            <Switch
              value={keepInTouch}
              onValueChange={setKeepInTouch}
              trackColor={{ false: '#211C2E', true: '#7B2FF7' }}
              thumbColor={keepInTouch ? '#F5F0FF' : '#A99BC2'}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 pb-8">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Submit Feedback"
            disabled={submitMutation.isPending}
            onPress={handleSubmit}
            className={`w-full py-4 bg-signal-violet rounded-full items-center justify-center shadow-lg active:scale-95 ${
              submitMutation.isPending ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#0D0B14" size="small" />
            ) : (
              <Text className="text-void font-display font-extrabold text-base">
                Submit Feedback
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Skip Feedback"
            onPress={handleSkip}
            className="w-full py-3.5 bg-transparent border border-hairline rounded-full items-center justify-center active:scale-95"
            activeOpacity={0.8}
          >
            <Text className="text-dusk font-display font-semibold text-sm">
              Skip
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mutual Match Modal Overlay */}
      {mutualMatchUser && (
        <View className="absolute inset-0 bg-black/85 items-center justify-center px-6 z-50">
          <View className="w-full bg-ink border border-signal-violet/50 rounded-3xl p-6 items-center shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-signal-violet/20 border border-signal-violet items-center justify-center mb-4">
              <Sparkles size={32} color="#C77DFF" />
            </View>
            <Text className="text-moonlight font-display text-2xl font-extrabold text-center mb-1">
              It's a Match!
            </Text>
            <Text className="text-pulse-lilac font-bold text-sm mb-2 text-center">
              You and {mutualMatchUser} kept the connection.
            </Text>
            <Text className="text-dusk text-xs text-center leading-relaxed mb-6">
              You both opted into staying in touch for this activity. Your profiles are now connected for future meetups!
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Continue"
              onPress={handleDismissMatch}
              className="w-full py-3.5 bg-signal-violet rounded-full items-center justify-center active:scale-95"
            >
              <Text className="text-void font-display font-bold text-sm">
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
