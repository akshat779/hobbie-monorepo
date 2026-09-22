import React from 'react';
import { Image, Text, View } from 'react-native';
import { getInitials } from '@hobbie/shared';

/** Nocturnal Pulse tints used for the initials fallback. */
const FALLBACK_TINTS = [
  '#7B2FF7',
  '#5B4B8A',
  '#3E7C8C',
  '#8A5A44',
  '#4C6B8A',
  '#6B4C8A',
];

/** Stable tint selection so a given name always renders the same colour. */
export function avatarTintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length]!;
}

export interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
}

/**
 * Circular profile photo with a deterministic initials fallback (first two
 * letters of the display name) when no photo has been uploaded.
 */
export function Avatar({ name, url, size = 96, className = '' }: AvatarProps) {
  const radius = size / 2;

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={`${name} profile photo`}
        style={{ width: size, height: size, borderRadius: radius }}
        className={className}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${name} initials avatar`}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: avatarTintFor(name) }}
      className={`items-center justify-center ${className}`}
    >
      <Text
        className="font-display font-bold text-moonlight"
        style={{ fontSize: Math.round(size * 0.34) }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
