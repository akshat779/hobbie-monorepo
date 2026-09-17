/**
 * Centralized, type-safe Query Key Factory for TanStack Query
 * Adheres strictly to the TanStack Query Best Practices skill:
 * - qk-array-structure: All keys are typed tuples
 * - qk-hierarchical-organization: Hierarchical scoping (domain -> entity -> id/params)
 * - qk-factory-pattern: Factory functions with autocomplete and zero stringly-typed typos
 * - qk-serializable: All arguments are primitives / serializable objects
 */

export const queryKeys = {
  all: ['hobbie'] as const,

  discovery: {
    all: () => [...queryKeys.all, 'discovery'] as const,
    nearby: (lat: number, lng: number, radiusKm: number) =>
      [...queryKeys.discovery.all(), 'nearby', lat, lng, radiusKm] as const,
  },

  activities: {
    all: () => [...queryKeys.all, 'activities'] as const,
    detail: (id: string) => [...queryKeys.activities.all(), 'detail', id] as const,
    mySquads: (userId: string) => [...queryKeys.activities.all(), 'mySquads', userId] as const,
    joinStatus: (activityId: string, userId: string) =>
      [...queryKeys.activities.detail(activityId), 'joinStatus', userId] as const,
    hostRequests: (activityId: string) =>
      [...queryKeys.activities.detail(activityId), 'hostRequests'] as const,
  },

  room: {
    all: () => [...queryKeys.all, 'room'] as const,
    messages: (roomId: string) => [...queryKeys.room.all(), 'messages', roomId] as const,
    meta: (roomId: string) => [...queryKeys.room.all(), 'meta', roomId] as const,
    members: (roomId: string) => [...queryKeys.room.all(), 'members', roomId] as const,
    exactLocation: (roomId: string) => [...queryKeys.room.all(), 'exactLocation', roomId] as const,
  },

  feedback: {
    all: () => [...queryKeys.all, 'feedback'] as const,
    hasReviewed: (activityId: string, userId: string) =>
      [...queryKeys.feedback.all(), 'hasReviewed', activityId, userId] as const,
  },

  profile: {
    all: () => [...queryKeys.all, 'profile'] as const,
    byId: (id: string) => [...queryKeys.profile.all(), id] as const,
  },
} as const;
