import React from 'react';
import { View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';

export interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

/**
 * Compact verification mark: a single shield icon. Used everywhere a member's
 * verified status is shown so the symbol stays consistent across the app.
 */
export function VerifiedBadge({ size = 14, className = '' }: VerifiedBadgeProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Verified member"
      className={className}
    >
      <ShieldCheck size={size} color="#C77DFF" />
    </View>
  );
}
