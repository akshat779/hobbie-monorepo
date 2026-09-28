/**
 * Which floating tab should show a notification dot.
 *
 * Kept as a pure selector so badge rules are unit-testable independently of
 * React, TanStack Query, and Realtime. New tab signals (e.g. pending feedback)
 * should be added here rather than in the tab bar.
 */
export interface TabBadges {
  index: boolean;
  list: boolean;
  'my-activities': boolean;
  profile: boolean;
}

export interface TabBadgeInputs {
  /** Join requests awaiting the host's decision across all hosted squads. */
  pendingHostRequests: number;
  /** Accepted requests the joiner has not opened My Squads since. */
  unseenAcceptances: number;
}

export function computeTabBadges({
  pendingHostRequests,
  unseenAcceptances,
}: TabBadgeInputs): TabBadges {
  const mySquads = pendingHostRequests > 0 || unseenAcceptances > 0;

  return {
    index: false,
    list: false,
    'my-activities': mySquads,
    profile: false,
  };
}
