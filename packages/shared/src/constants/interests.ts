export const INTEREST_CATEGORIES = [
  { id: 'football', label: 'Football', icon: 'soccer', category: 'sports', emoji: '⚽' },
  { id: 'badminton', label: 'Badminton', icon: 'badminton', category: 'sports', emoji: '🏸' },
  { id: 'table_tennis', label: 'Table Tennis', icon: 'table-tennis', category: 'sports', emoji: '🏓' },
  { id: 'gym_fitness', label: 'Gym & Fitness', icon: 'dumbbell', category: 'fitness', emoji: '🏋️' },
  { id: 'running', label: 'Running / Walking', icon: 'run', category: 'fitness', emoji: '🏃' },
  { id: 'cafe_coffee', label: 'Coffee & Cafe', icon: 'coffee', category: 'social', emoji: '☕' },
  { id: 'coworking', label: 'Coworking / Study', icon: 'laptop', category: 'tech', emoji: '💻' },
  { id: 'coding_tech', label: 'Coding / Hack', icon: 'code', category: 'tech', emoji: '⚡' },
  { id: 'board_games', label: 'Board Games', icon: 'dice', category: 'gaming', emoji: '🎲' },
  { id: 'nightlife', label: 'Drinks & Nightlife', icon: 'glass-cocktail', category: 'social', emoji: '🍸' },
] as const;

export type InterestId = (typeof INTEREST_CATEGORIES)[number]['id'];

export const INTEREST_IDS = INTEREST_CATEGORIES.map((i) => i.id) as [
  InterestId,
  ...InterestId[]
];

/** Human-readable label for an interest id, falling back to the raw id. */
export function interestLabel(id: string): string {
  return INTEREST_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/** Canonical map-pin emoji for an interest id, falling back to a neutral glyph. */
export function interestEmoji(id: string): string {
  return INTEREST_CATEGORIES.find((category) => category.id === id)?.emoji ?? '✨';
}
