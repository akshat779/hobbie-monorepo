import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Flag,
  Ban,
  CircleCheck,
  X,
  Check,
  Heart,
  UserX,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import {
  calculateAge,
  interestLabel,
  languageLabel,
  REPORT_REASONS,
  type ReportReason,
  type PublicProfile,
  type FuzzedDistance,
} from '@hobbie/shared';
import { useAuthStore } from '../../src/features/auth/useAuthStore';
import { useReviewRequestMutation } from '../../src/features/activity/useActivityMutations';
import { fetchPublicProfile, getFuzzedDistance } from '../../src/services/publicProfile';
import {
  blockUser,
  hasBlockedUser,
  reportUser,
  unblockUser,
} from '../../src/services/moderation';
import { Avatar } from '../../src/components/common/Avatar';
import { VerifiedBadge } from '../../src/components/common/VerifiedBadge';
import { GENDER_LABELS, getInterestIcon } from '../../src/features/profile/profileMeta';

const HERO_HEIGHT = Math.round(Dimensions.get('window').width * 1.2);

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: 'Harassment or abuse',
  catfishing: 'Fake profile / catfishing',
  no_show: 'Did not show up',
  unsafe_behavior: 'Unsafe behaviour',
  spam: 'Spam',
  other: 'Something else',
};

function formatDistance(distance: FuzzedDistance): string | null {
  if (!distance.available || distance.distanceM === undefined) return null;
  if (distance.distanceM < 1000) return `${distance.distanceM} m away`;
  return `${(distance.distanceM / 1000).toFixed(distance.distanceM < 10000 ? 1 : 0)} km away`;
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    userId: string;
    activityId?: string;
    requestId?: string;
    currentCount?: string;
    maxParticipants?: string;
  }>();
  const userId = params.userId;

  const { user } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const reviewMutation = useReviewRequestMutation();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [distance, setDistance] = useState<FuzzedDistance>({ available: false });
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const [fetched, dist, blocked] = await Promise.all([
      fetchPublicProfile(userId),
      getFuzzedDistance(userId),
      hasBlockedUser(userId),
    ]);
    setProfile(fetched);
    setDistance(dist);
    setIsBlocked(blocked);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const photos =
    profile?.photoUrls?.length
      ? profile.photoUrls
      : profile?.avatarUrl
        ? [profile.avatarUrl]
        : [];

  const goToPhoto = (index: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, index));
    setPhotoIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * Dimensions.get('window').width, animated: true });
  };

  const runDecision = async (action: 'accept' | 'decline') => {
    if (!params.requestId || !params.activityId || !user?.id) return;
    if (isProcessing) return;
    setIsProcessing(true);
    setActionError('');
    try {
      await reviewMutation.mutateAsync({
        action,
        requestId: params.requestId,
        hostId: user.id,
        activityId: params.activityId,
      });
      router.back();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not process the request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBlock = () => {
    Alert.alert(
      isBlocked ? 'Unblock this user?' : 'Block this user?',
      isBlocked
        ? 'They will become visible in discovery and squads again.'
        : 'You will no longer see their squads, and they cannot request to join yours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlocked ? 'Unblock' : 'Block',
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            const res = isBlocked ? await unblockUser(userId) : await blockUser(userId);
            if (res.success) {
              setIsBlocked(!isBlocked);
            } else {
              setActionError(res.error ?? 'Action failed');
            }
          },
        },
      ]
    );
  };

  const canDecide = Boolean(params.requestId && params.activityId);
  const currentCount = Number(params.currentCount ?? 0);
  const maxParticipants = Number(params.maxParticipants ?? 0);
  const isSquadFull = canDecide && maxParticipants > 0 && currentCount >= maxParticipants;

  return (
    <View className="flex-1 bg-void">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: canDecide ? 140 : 48 }}
      >
        {/* Photo hero */}
        <View style={{ height: HERO_HEIGHT }} className="bg-ink">
          {photos.length > 0 ? (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setPhotoIndex(idx);
              }}
            >
              {photos.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  source={{ uri: url }}
                  style={{ width: Dimensions.get('window').width, height: HERO_HEIGHT }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Avatar name={profile?.name ?? ''} url={null} size={120} />
            </View>
          )}

          {/* Segmented progress bars */}
          {photos.length > 1 ? (
            <View className="absolute top-3 left-3 right-3 flex-row">
              {photos.map((_, i) => (
                <View
                  key={i}
                  className={`flex-1 h-[3px] rounded-full mx-0.5 ${
                    i <= photoIndex ? 'bg-moonlight' : 'bg-void/50'
                  }`}
                />
              ))}
            </View>
          ) : null}

          {/* Tap zones */}
          {photos.length > 1 ? (
            <>
              <Pressable
                accessibilityLabel="Previous photo"
                onPress={() => goToPhoto(photoIndex - 1)}
                className="absolute left-0 top-0 bottom-0 w-1/3"
              />
              <Pressable
                accessibilityLabel="Next photo"
                onPress={() => goToPhoto(photoIndex + 1)}
                className="absolute right-0 top-0 bottom-0 w-1/3"
              />
            </>
          ) : null}
        </View>

        {/* Name + meta */}
        <View className="px-5 -mt-6">
          <View className="bg-ink border border-hairline rounded-3xl p-4">
            <View className="flex-row items-center">
              <Text className="text-moonlight font-display text-2xl font-extrabold mr-2">
                {profile ? `${profile.name}, ${calculateAge(profile.birthDate)}` : 'Profile'}
              </Text>
              {profile?.isVerified ? <VerifiedBadge size={18} /> : null}
            </View>

            <View className="flex-row items-center mt-2 flex-wrap">
              {formatDistance(distance) ? (
                <View className="flex-row items-center bg-void border border-hairline px-2.5 py-1 rounded-full mr-2 mb-1">
                  <MapPin size={12} color="#A99BC2" />
                  <Text className="text-2xs text-dusk font-semibold ml-1">
                    {formatDistance(distance)}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-center bg-void border border-hairline px-2.5 py-1 rounded-full mb-1">
                <Star size={12} color="#C77DFF" />
                <Text className="text-2xs text-pulse-lilac font-bold ml-1">
                  {profile?.trustScore.toFixed(2) ?? '—'} trust
                </Text>
              </View>
            </View>

            {profile?.bio ? (
              <Text className="text-sm text-dusk leading-relaxed mt-3">{profile.bio}</Text>
            ) : null}
          </View>
        </View>

        {/* Basics */}
        {profile ? (
          <Section icon={<Sparkles size={14} color="#C77DFF" />} title="Basics">
            <InfoRow label="Age" value={`${calculateAge(profile.birthDate)} yrs`} />
            <InfoRow label="Gender" value={GENDER_LABELS[profile.gender]} />
            <InfoRow
              label="Languages"
              value={
                profile.preferredLanguages.length
                  ? profile.preferredLanguages.map((c) => languageLabel(c)).join(', ')
                  : '—'
              }
              last
            />
          </Section>
        ) : null}

        {/* Trust */}
        {profile ? (
          <Section icon={<ShieldCheck size={14} color="#C77DFF" />} title="Trust">
            <InfoRow
              label="Verified"
              value={profile.isVerified ? 'Yes' : 'Not yet'}
            />
            <InfoRow label="Trust score" value={`★ ${profile.trustScore.toFixed(2)}`} />
            <InfoRow label="Squads joined" value={`${profile.interactionCount}`} />
            <InfoRow label="Ratings" value={`${profile.ratingsCount}`} last />
          </Section>
        ) : null}

        {/* Interests */}
        {profile && profile.interests.length ? (
          <Section icon={<Heart size={14} color="#C77DFF" />} title="Interests">
            <View className="flex-row flex-wrap gap-2 pt-1">
              {profile.interests.map((id) => (
                <View
                  key={id}
                  className="flex-row items-center bg-ink border border-hairline px-3 py-2 rounded-2xl"
                >
                  {getInterestIcon(id, '#C77DFF')}
                  <Text className="text-xs font-semibold text-moonlight ml-1.5">
                    {interestLabel(id)}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Safety */}
        <View className="px-5 mt-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Report this user"
            onPress={() => setReportOpen(true)}
            className="flex-row items-center justify-center h-12 rounded-2xl bg-ink border border-hairline mb-2.5"
            activeOpacity={0.7}
          >
            <Flag size={15} color="#A99BC2" />
            <Text className="text-dusk text-xs font-semibold ml-2">Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isBlocked ? 'Unblock this user' : 'Block this user'}
            onPress={handleToggleBlock}
            className="flex-row items-center justify-center h-12 rounded-2xl bg-ink border border-hairline"
            activeOpacity={0.7}
          >
            <Ban size={15} color={isBlocked ? '#C77DFF' : '#A99BC2'} />
            <Text
              className={`text-xs font-semibold ml-2 ${isBlocked ? 'text-pulse-lilac' : 'text-dusk'}`}
            >
              {isBlocked ? 'Unblock' : 'Block'}
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#C77DFF" />
          </View>
        ) : null}

        {!isLoading && !profile ? (
          <Text className="text-dusk text-xs text-center mt-6 px-8">
            This profile is unavailable.
          </Text>
        ) : null}
      </ScrollView>

      {/* Back button */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={{ top: insets.top + 8 }}
        className="absolute left-4 w-11 h-11 rounded-full bg-void/80 border border-hairline items-center justify-center"
        activeOpacity={0.7}
      >
        <ChevronLeft size={20} color="#F5F0FF" />
      </TouchableOpacity>

      {/* Pinned host decision bar */}
      {canDecide ? (
        <View
          style={{ paddingBottom: insets.bottom + 14 }}
          className="absolute left-0 right-0 bottom-0 bg-void/95 border-t border-hairline px-5 pt-3"
        >
          {actionError ? (
            <Text className="text-2xs text-ember font-medium text-center mb-2">{actionError}</Text>
          ) : null}
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Decline request"
              onPress={() => runDecision('decline')}
              disabled={isProcessing}
              className="flex-1 h-14 rounded-full bg-ink border border-hairline items-center justify-center flex-row"
              activeOpacity={0.7}
            >
              <UserX size={16} color="#A99BC2" style={{ marginRight: 6 }} />
              <Text className="text-dusk text-sm font-semibold">Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Accept request"
              onPress={() => runDecision('accept')}
              disabled={isProcessing || isSquadFull}
              className={`flex-1 h-14 rounded-full flex-row items-center justify-center border ${
                isSquadFull
                  ? 'bg-ink border-hairline opacity-50'
                  : 'bg-signal-violet border-signal-violet-light/30'
              }`}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#F5F0FF" />
              ) : (
                <>
                  <Check size={16} color="#F5F0FF" style={{ marginRight: 6 }} />
                  <Text className="text-moonlight text-sm font-bold font-display">
                    Accept{maxParticipants > 0 ? ` (${currentCount}/${maxParticipants})` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Report sheet */}
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetUserId={userId}
        activityId={params.activityId}
      />
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="px-5 mt-4">
      <View className="bg-ink border border-hairline rounded-3xl p-4">
        <View className="flex-row items-center mb-1">
          {icon}
          <Text className="text-pulse-lilac text-xs font-bold uppercase tracking-wider ml-1.5">
            {title}
          </Text>
        </View>
        {children}
      </View>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between py-3 ${
        last ? '' : 'border-b border-hairline/60'
      }`}
    >
      <Text className="text-dusk text-xs">{label}</Text>
      <Text className="text-moonlight text-xs font-semibold flex-1 text-right ml-3" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ReportSheet({
  visible,
  onClose,
  targetUserId,
  activityId,
}: {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  activityId?: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const submit = async () => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    setStatus('');
    const res = await reportUser({ targetUserId, activityId, reason, notes });
    setIsSubmitting(false);
    if (res.success) {
      setReason(null);
      setNotes('');
      onClose();
    } else {
      setStatus(res.error ?? 'Could not submit report');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ paddingTop: 16 }} className="flex-1 bg-void px-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-moonlight font-display text-lg font-bold">Report user</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close report"
            onPress={onClose}
            className="w-10 h-10 rounded-full bg-ink border border-hairline items-center justify-center"
          >
            <X size={16} color="#F5F0FF" />
          </TouchableOpacity>
        </View>

        <Text className="text-dusk text-xs mb-3">
          Reports are reviewed by a human. Your identity is never shared.
        </Text>

        {REPORT_REASONS.map((r) => (
          <TouchableOpacity
            key={r}
            accessibilityRole="button"
            accessibilityLabel={REPORT_REASON_LABELS[r]}
            accessibilityState={{ selected: reason === r }}
            onPress={() => setReason(r)}
            className={`flex-row items-center justify-between h-12 px-4 rounded-2xl border mb-2 ${
              reason === r ? 'border-signal-violet bg-signal-violet/15' : 'border-hairline bg-ink'
            }`}
            activeOpacity={0.7}
          >
            <Text className={`text-sm ${reason === r ? 'text-moonlight' : 'text-dusk'}`}>
              {REPORT_REASON_LABELS[r]}
            </Text>
            {reason === r ? <CircleCheck size={16} color="#C77DFF" /> : null}
          </TouchableOpacity>
        ))}

        <TextInput
          className="bg-ink border border-hairline rounded-2xl px-4 py-3 text-moonlight text-sm mt-2"
          placeholder="Add details (optional)"
          placeholderTextColor="#5A536B"
          multiline
          value={notes}
          onChangeText={setNotes}
          maxLength={500}
        />

        {status ? <Text className="text-2xs text-ember mt-2">{status}</Text> : null}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          onPress={submit}
          disabled={!reason || isSubmitting}
          className={`h-14 rounded-full items-center justify-center mt-4 ${
            reason ? 'bg-signal-violet' : 'bg-ink-raised border border-hairline'
          }`}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#F5F0FF" />
          ) : (
            <Text className={`text-sm font-bold font-display ${reason ? 'text-moonlight' : 'text-dusk'}`}>
              Submit report
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
