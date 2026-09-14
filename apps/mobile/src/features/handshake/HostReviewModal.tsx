import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  ShieldCheck,
  Check,
  UserX,
  Users,
  Clock,
  Sparkles,
  Inbox,
} from 'lucide-react-native';
import {
  IncomingJoinRequest,
  fetchIncomingJoinRequests,
  acceptJoinRequestTx,
  declineJoinRequest,
  subscribeToHostQueue,
} from '../../services/handshake';
import { useAuthStore } from '../auth/useAuthStore';
import { useReviewRequestMutation } from '../activity/useActivityMutations';

interface HostReviewModalProps {
  visible: boolean;
  activityId: string;
  activityTitle: string;
  currentParticipantsCount: number;
  maxParticipants: number;
  onClose: () => void;
  onSquadUpdated?: () => void;
}

export function HostReviewModal({
  visible,
  activityId,
  activityTitle,
  currentParticipantsCount,
  maxParticipants,
  onClose,
  onSquadUpdated,
}: HostReviewModalProps) {
  const hostId = useAuthStore((s) => s.user?.id || '');
  const reviewMutation = useReviewRequestMutation();

  const [requests, setRequests] = useState<IncomingJoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [localCount, setLocalCount] = useState(currentParticipantsCount);

  useEffect(() => {
    setLocalCount(currentParticipantsCount);
  }, [currentParticipantsCount]);

  const loadRequests = useCallback(async () => {
    if (!activityId) return;
    setIsLoading(true);
    const data = await fetchIncomingJoinRequests(activityId);
    setRequests(data);
    setIsLoading(false);
  }, [activityId]);

  useEffect(() => {
    if (!visible || !activityId) return;

    loadRequests();

    // Subscribe to realtime join request additions / updates
    const unsubscribe = subscribeToHostQueue(activityId, () => {
      loadRequests();
    });

    return () => {
      unsubscribe();
    };
  }, [visible, activityId, loadRequests]);

  const handleAccept = async (requestId: string, joinerName: string) => {
    // Snapshot current local state for immediate rollback if needed
    const previousRequests = [...requests];
    const previousCount = localCount;

    // 1. Instant optimistic visual feedback (0ms latency)
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setLocalCount((prev) => Math.min(prev + 1, maxParticipants));
    setStatusMessage({ text: `Accepted ${joinerName} into squad! Room unlocked.` });
    onSquadUpdated?.();

    // 2. Fire mutation in background with rollback
    try {
      await reviewMutation.mutateAsync({
        action: 'accept',
        requestId,
        hostId,
        activityId,
      });
    } catch (err: any) {
      // Rollback local state on failure
      setRequests(previousRequests);
      setLocalCount(previousCount);
      setStatusMessage({ text: err?.message || 'Error processing request', isError: true });
    }
  };

  const handleDecline = async (requestId: string, joinerName: string) => {
    const previousRequests = [...requests];

    // 1. Instant optimistic visual feedback (0ms latency)
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setStatusMessage({ text: `Declined request from ${joinerName}.` });
    onSquadUpdated?.();

    // 2. Fire mutation in background with rollback
    try {
      await reviewMutation.mutateAsync({
        action: 'decline',
        requestId,
        hostId,
        activityId,
      });
    } catch (err: any) {
      setRequests(previousRequests);
      setStatusMessage({ text: err?.message || 'Error declining request', isError: true });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-void px-5 pt-4 pb-8 justify-between">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row justify-between items-center pb-4 mb-2 border-b border-hairline">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center mb-1">
                <Users size={14} color="#C77DFF" />
                <Text className="text-pulse-lilac font-mono text-xs font-bold ml-1.5 uppercase">
                  Host Review Queue
                </Text>
              </View>
              <Text
                numberOfLines={1}
                className="text-moonlight font-display text-lg font-bold"
              >
                {activityTitle}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close review modal"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClose}
              className="w-11 h-11 rounded-full bg-ink border border-hairline items-center justify-center"
              activeOpacity={0.7}
            >
              <X size={18} color="#F5F0FF" />
            </TouchableOpacity>
          </View>

          {/* Capacity Bar */}
          <View className="flex-row items-center justify-between bg-ink border border-hairline px-4 py-3 rounded-2xl mb-4">
            <Text className="text-dusk font-body text-xs font-medium">
              Squad Capacity Status
            </Text>
            <View className="flex-row items-center">
              <Text className="text-moonlight font-mono text-xs font-bold">
                {localCount} / {maxParticipants} Spots Filled
              </Text>
              {localCount >= maxParticipants && (
                <View className="ml-2 bg-ember/20 px-2 py-0.5 rounded-full border border-ember/60">
                  <Text className="text-ember font-bold text-2xs">FULL</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status Toast */}
          {statusMessage && (
            <View
              className={`p-3 rounded-2xl mb-4 border ${
                statusMessage.isError
                  ? 'bg-ember/15 border-ember/60'
                  : 'bg-signal-violet/20 border-signal-violet/60'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  statusMessage.isError ? 'text-ember' : 'text-moonlight'
                }`}
              >
                {statusMessage.text}
              </Text>
            </View>
          )}

          {/* Requests Content */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="small" color="#7B2FF7" />
              <Text className="text-dusk font-body text-xs mt-3">
                Loading pending joiners...
              </Text>
            </View>
          ) : requests.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6 py-12">
              <View className="w-14 h-14 rounded-full bg-ink border border-hairline items-center justify-center mb-4">
                <Inbox size={26} color="#A99BC2" />
              </View>
              <Text className="text-moonlight font-display text-base font-bold text-center mb-1.5">
                No Pending Join Requests
              </Text>
              <Text className="text-dusk font-body text-xs text-center leading-relaxed">
                Your squad is live on the discovery radar. When nearby players request to join,
                they will appear here instantly for 1-tap review.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              className="flex-1"
            >
              <Text className="text-dusk font-body text-xs uppercase font-semibold tracking-wider mb-3">
                Pending Joiners ({requests.length})
              </Text>

              {requests.map((req) => {
                const isProcessing = processingId === req.id;
                const isSquadFull = localCount >= maxParticipants;

                return (
                  <View
                    key={req.id}
                    className="bg-ink border border-hairline rounded-3xl p-4 mb-3.5"
                  >
                    {/* Joiner Row */}
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <View className="flex-row items-center">
                          <Text className="text-moonlight font-display font-bold text-base mr-2">
                            {req.user.name}
                          </Text>
                          {req.user.isVerified && (
                            <View className="bg-signal-violet/20 border border-signal-violet/60 px-2 py-0.5 rounded-full flex-row items-center">
                              <ShieldCheck size={11} color="#D2BBFF" />
                              <Text className="text-signal-violet-light text-2xs font-bold ml-1">
                                Verified
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Trust Score Badge */}
                      <View className="bg-void border border-hairline px-2.5 py-1 rounded-full">
                        <Text className="text-pulse-lilac font-mono text-xs font-bold">
                          ★ {req.user.trustScore.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Requester Message / Note */}
                    {req.message ? (
                      <View className="bg-void/70 border border-hairline/60 rounded-2xl p-3 mb-3.5">
                        <Text className="text-dusk font-body text-xs leading-relaxed italic">
                          "{req.message}"
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-dusk/60 font-body text-xs mb-3 italic">
                        No intro note provided
                      </Text>
                    )}

                    {/* Action Buttons */}
                    <View className="flex-row gap-2.5">
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Decline request from ${req.user.name}`}
                        onPress={() => handleDecline(req.id, req.user.name)}
                        disabled={isProcessing}
                        className="flex-1 h-12 rounded-full bg-void border border-hairline items-center justify-center flex-row active:bg-ink-raised"
                        activeOpacity={0.7}
                      >
                        <UserX size={15} color="#A99BC2" style={{ marginRight: 6 }} />
                        <Text className="text-dusk font-body text-xs font-semibold">
                          Decline
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        testID={`accept-join-${req.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept ${req.user.name} into squad`}
                        onPress={() => handleAccept(req.id, req.user.name)}
                        disabled={isProcessing || isSquadFull}
                        className={`flex-1 h-12 rounded-full flex-row items-center justify-center border ${
                          isSquadFull
                            ? 'bg-ink border-hairline opacity-50'
                            : 'bg-signal-violet border-signal-violet-light/30 active:scale-95'
                        }`}
                        activeOpacity={0.85}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#F5F0FF" />
                        ) : (
                          <>
                            <Check size={15} color="#F5F0FF" style={{ marginRight: 6 }} />
                            <Text className="text-moonlight font-display text-xs font-bold">
                              Accept ({localCount}/{maxParticipants})
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Close Button */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Done Reviewing"
          onPress={onClose}
          className="w-full h-14 rounded-full bg-ink border border-hairline items-center justify-center active:bg-ink-raised"
          activeOpacity={0.7}
        >
          <Text className="text-moonlight font-body text-sm font-semibold">
            Done Reviewing
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
