import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiscoveryFiltersState, GenderFilterOption, AgeGroupOption } from './types';

interface DiscoveryFiltersStore {
  filters: DiscoveryFiltersState;
  setRadiusKm: (radiusKm: number) => void;
  setGender: (gender: GenderFilterOption) => void;
  setAgeGroup: (ageGroup: AgeGroupOption) => void;
  setFilters: (filters: DiscoveryFiltersState) => void;
  resetFilters: () => void;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFiltersState = {
  radiusKm: 4.5,
  gender: 'all',
  ageGroup: 'all',
};

export const useDiscoveryFiltersStore = create<DiscoveryFiltersStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_DISCOVERY_FILTERS,
      setRadiusKm: (radiusKm) =>
        set((state) => ({ filters: { ...state.filters, radiusKm } })),
      setGender: (gender) =>
        set((state) => ({ filters: { ...state.filters, gender } })),
      setAgeGroup: (ageGroup) =>
        set((state) => ({ filters: { ...state.filters, ageGroup } })),
      setFilters: (filters) => set({ filters }),
      resetFilters: () => set({ filters: DEFAULT_DISCOVERY_FILTERS }),
    }),
    {
      name: 'hobbie-discovery-filters',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);
