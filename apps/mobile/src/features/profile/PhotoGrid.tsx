import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { MAX_PROFILE_PHOTOS } from '@hobbie/shared';
import { pickGalleryImage, uploadProfilePhoto } from '../../services/avatar';

export interface PhotoGridProps {
  /** Authenticated user id; required to upload. */
  userId?: string;
  /** Ordered photo URLs. Index 0 is the cover photo. */
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  /** When > 0, shows the remaining count needed in the helper line. */
  minRequired?: number;
  error?: string;
  onError?: (message: string) => void;
}

/**
 * Tinder-style photo gallery: a fixed grid of dashed slots, each with a `+`
 * badge, where picking a photo uploads it immediately and fills the slot.
 * Uploads happen on select so callers only ever hold final URLs.
 */
export function PhotoGrid({
  userId,
  photos,
  onChange,
  max = MAX_PROFILE_PHOTOS,
  minRequired = 0,
  error,
  onError,
}: PhotoGridProps) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const slots = Array.from({ length: max });

  const handleSlotPress = async (index: number) => {
    if (busyIndex !== null) return;
    if (!userId) {
      onError?.('Session expired. Please sign in again.');
      return;
    }

    setBusyIndex(index);
    try {
      const picked = await pickGalleryImage();
      if (picked.error) {
        onError?.(picked.error);
        return;
      }
      if (!picked.image) return;

      const uploaded = await uploadProfilePhoto({ userId, image: picked.image, index });
      if (uploaded.error || !uploaded.url) {
        onError?.(uploaded.error ?? 'Could not upload your photo. Try again.');
        return;
      }

      const next = [...photos];
      if (index < next.length) {
        next[index] = uploaded.url;
      } else {
        next.push(uploaded.url);
      }
      onChange(next);
    } finally {
      setBusyIndex(null);
    }
  };

  const handleRemove = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  const remaining = Math.max(0, minRequired - photos.length);

  return (
    <View>
      <View className="flex-row flex-wrap justify-between">
        {slots.map((_, index) => {
          const url = photos[index];
          const isBusy = busyIndex === index;

          return (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityLabel={url ? `Replace photo ${index + 1}` : `Add photo ${index + 1}`}
              onPress={() => handleSlotPress(index)}
              activeOpacity={0.8}
              disabled={busyIndex !== null}
              className={`mb-3 rounded-2xl overflow-hidden bg-ink ${
                url ? 'border border-hairline' : 'border border-dashed border-hairline'
              }`}
              style={{ width: '31.5%', aspectRatio: 3 / 4 }}
            >
              {url ? (
                <Image source={{ uri: url }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <View className="flex-1" />
              )}

              {isBusy ? (
                <View className="absolute inset-0 items-center justify-center bg-black/50">
                  <ActivityIndicator color="#F5F0FF" />
                </View>
              ) : null}

              {url && !isBusy ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  onPress={() => handleRemove(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-void/80 border border-hairline items-center justify-center"
                >
                  <X size={13} color="#F5F0FF" />
                </TouchableOpacity>
              ) : null}

              {!url && !isBusy ? (
                <View className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-signal-violet items-center justify-center border-2 border-void">
                  <Plus size={14} color="#F5F0FF" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-row items-center mt-1">
        <View className="w-9 h-9 rounded-full border border-hairline items-center justify-center">
          <Text className="text-2xs font-mono font-bold text-moonlight">
            {photos.length}/{max}
          </Text>
        </View>
        <Text className="text-xs text-dusk ml-3 flex-1">
          {remaining > 0
            ? `Add ${remaining} more to get started. A clear face photo works best.`
            : 'Tap a photo to replace it, or × to remove.'}
        </Text>
      </View>

      {error ? <Text className="text-xs text-ember font-medium mt-2 ml-1">{error}</Text> : null}
    </View>
  );
}
