import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local, per-device notification state. The server is the source of truth for
 * *pending* work (e.g. host join requests); this store only tracks "unseen"
 * events that have no server-side read flag, currently a joiner's accepted
 * request. It is keyed by owner so switching dev users or signing out can
 * never leak another user's dot.
 */
interface NotificationsStore {
  ownerId: string | null;
  unseenAcceptedActivityIds: string[];
  setOwner: (ownerId: string | null) => void;
  markActivityAccepted: (activityId: string) => void;
  clearUnseenAcceptances: () => void;
}

export const useNotificationsStore = create<NotificationsStore>()(
  persist(
    (set) => ({
      ownerId: null,
      unseenAcceptedActivityIds: [],
      // Switching identity resets unseen state in the same commit, so a stale
      // dot can never render for the incoming user.
      setOwner: (ownerId) =>
        set((state) =>
          state.ownerId === ownerId
            ? state
            : { ownerId, unseenAcceptedActivityIds: [] }
        ),
      markActivityAccepted: (activityId) =>
        set((state) =>
          state.unseenAcceptedActivityIds.includes(activityId)
            ? state
            : {
                unseenAcceptedActivityIds: [
                  ...state.unseenAcceptedActivityIds,
                  activityId,
                ],
              }
        ),
      clearUnseenAcceptances: () => set({ unseenAcceptedActivityIds: [] }),
    }),
    {
      name: 'hobbie-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        ownerId: state.ownerId,
        unseenAcceptedActivityIds: state.unseenAcceptedActivityIds,
      }),
    }
  )
);
