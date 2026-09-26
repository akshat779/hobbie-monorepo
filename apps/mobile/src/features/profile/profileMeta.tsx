import React from 'react';
import {
  Activity,
  Zap,
  Sparkles,
  Dumbbell,
  Flame,
  Coffee,
  Laptop,
  Code2,
  Dice5,
  Wine,
} from 'lucide-react-native';
import { USER_GENDERS } from '@hobbie/shared';

export type Gender = (typeof USER_GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  'non-binary': 'Non-binary',
  'prefer-not-to-say': 'Prefer not to say',
};

/** Canonical Lucide icon for an interest id, sized and tinted by the caller. */
export function getInterestIcon(id: string, color: string, size = 18): React.ReactNode {
  switch (id) {
    case 'football':
      return <Activity size={size} color={color} />;
    case 'badminton':
      return <Zap size={size} color={color} />;
    case 'table_tennis':
      return <Sparkles size={size} color={color} />;
    case 'gym_fitness':
      return <Dumbbell size={size} color={color} />;
    case 'running':
      return <Flame size={size} color={color} />;
    case 'cafe_coffee':
      return <Coffee size={size} color={color} />;
    case 'coworking':
      return <Laptop size={size} color={color} />;
    case 'coding_tech':
      return <Code2 size={size} color={color} />;
    case 'board_games':
      return <Dice5 size={size} color={color} />;
    case 'nightlife':
      return <Wine size={size} color={color} />;
    default:
      return <Sparkles size={size} color={color} />;
  }
}
