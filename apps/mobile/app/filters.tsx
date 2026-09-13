import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal, Check, MapPin, Users, UserCheck } from 'lucide-react-native';
import { RadiusSlider } from '../src/components/common/RadiusSlider';
import {
  AgeGroupOption,
  GenderFilterOption,
} from '../src/features/discovery/types';
import { useShallow } from 'zustand/react/shallow';
import { useDiscoveryFiltersStore } from '../src/features/discovery/useDiscoveryFiltersStore';

const GENDER_OPTIONS: { id: GenderFilterOption; label: string }[] = [
  { id: 'all', label: 'All Genders' },
  { id: 'women_only', label: 'Women Only' },
  { id: 'men_only', label: 'Men Only' },
  { id: 'coed', label: 'Co-ed Squads' },
];

const AGE_OPTIONS: { id: AgeGroupOption; label: string }[] = [
  { id: 'all', label: 'All Ages (18+)' },
  { id: '18_24', label: '18 – 24 yrs' },
  { id: '25_34', label: '25 – 34 yrs' },
  { id: '35_plus', label: '35+ yrs' },
];

export default function FiltersModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters, resetFilters } = useDiscoveryFiltersStore(
    useShallow((s) => ({
      filters: s.filters,
      setFilters: s.setFilters,
      resetFilters: s.resetFilters,
    }))
  );

  const [localRadius, setLocalRadius] = useState<number>(filters.radiusKm);
  const [localGender, setLocalGender] = useState<GenderFilterOption>(filters.gender);
  const [localAge, setLocalAge] = useState<AgeGroupOption>(filters.ageGroup);

  const handleReset = () => {
    setLocalRadius(4.5);
    setLocalGender('all');
    setLocalAge('all');
    resetFilters();
  };

  const handleApply = () => {
    setFilters({
      radiusKm: localRadius,
      gender: localGender,
      ageGroup: localAge,
    });
    router.back();
  };

  const hasActiveFilters =
    localRadius !== 4.5 || localGender !== 'all' || localAge !== 'all';

  return (
    <View style={styles.container}>
      {/* Main Filter Content */}
      <View style={styles.contentArea}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <SlidersHorizontal size={18} color="#C77DFF" />
            <Text style={styles.headerTitle}>Discovery Filters</Text>
          </View>

          {/* Reset All Button: fixed layout footprint with opacity to eliminate content shifting */}
          <TouchableOpacity
            onPress={handleReset}
            disabled={!hasActiveFilters}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={[
              styles.resetButton,
              { opacity: hasActiveFilters ? 1 : 0 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
          >
            <Text style={styles.resetButtonText}>Reset All</Text>
          </TouchableOpacity>
        </View>

        {/* Section 1: Radius Slider with Inline Distance Pill */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <MapPin size={15} color="#C77DFF" />
              <Text style={styles.sectionTitle}>Discovery Radius</Text>
            </View>
            <View style={styles.radiusPill}>
              <Text style={styles.radiusPillText}>
                {localRadius >= 50 ? '50+ km (Virtual)' : `${localRadius.toFixed(1)} km`}
              </Text>
            </View>
          </View>

          <RadiusSlider
            value={localRadius}
            onChange={setLocalRadius}
            min={1}
            max={50}
            step={0.5}
          />
        </View>

        {/* Section 2: Gender Preference (2x2 Grid Chips) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <UserCheck size={15} color="#C77DFF" />
              <Text style={styles.sectionTitle}>Gender Preference</Text>
            </View>
          </View>

          <View style={styles.chipsGrid}>
            {GENDER_OPTIONS.map((g) => {
              const isSelected = localGender === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  accessibilityRole="button"
                  accessibilityLabel={g.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setLocalGender(g.id)}
                  activeOpacity={0.75}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected ? styles.chipLabelSelected : styles.chipLabelUnselected,
                    ]}
                  >
                    {g.label}
                  </Text>

                  {isSelected ? (
                    <View style={styles.checkCircleSelected}>
                      <Check size={11} color="#F5F0FF" />
                    </View>
                  ) : (
                    <View style={styles.checkCircleUnselected} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section 3: Age Demographic (2x2 Grid Chips) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Users size={15} color="#C77DFF" />
              <Text style={styles.sectionTitle}>Age Demographic</Text>
            </View>
          </View>

          <View style={styles.chipsGrid}>
            {AGE_OPTIONS.map((a) => {
              const isSelected = localAge === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setLocalAge(a.id)}
                  activeOpacity={0.75}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      isSelected ? styles.chipLabelSelected : styles.chipLabelUnselected,
                    ]}
                  >
                    {a.label}
                  </Text>

                  {isSelected ? (
                    <View style={styles.checkCircleSelected}>
                      <Check size={11} color="#F5F0FF" />
                    </View>
                  ) : (
                    <View style={styles.checkCircleUnselected} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Pinned Docked Footer CTA */}
      <View
        style={[
          styles.footerContainer,
          { paddingBottom: Math.max(insets.bottom, 22) },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Apply Filters"
          onPress={handleApply}
          activeOpacity={0.85}
          style={styles.applyButton}
        >
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17131F',
    justifyContent: 'space-between',
  },
  contentArea: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
    paddingBottom: 12,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2739',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F5F0FF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resetButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(199, 125, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(199, 125, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: '#C77DFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#F5F0FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  radiusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: '#211C2E',
    borderWidth: 1,
    borderColor: 'rgba(123, 47, 247, 0.4)',
  },
  radiusPillText: {
    color: '#C77DFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '48.2%',
    minHeight: 46,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipSelected: {
    backgroundColor: 'rgba(123, 47, 247, 0.16)',
    borderColor: '#7B2FF7',
  },
  chipUnselected: {
    backgroundColor: '#0D0B14',
    borderColor: '#2C2739',
  },
  chipLabel: {
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  chipLabelSelected: {
    color: '#F5F0FF',
  },
  chipLabelUnselected: {
    color: '#A99BC2',
  },
  checkCircleSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#7B2FF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleUnselected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3D3550',
  },
  footerContainer: {
    backgroundColor: '#17131F',
    borderTopWidth: 1,
    borderTopColor: '#2C2739',
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  applyButton: {
    width: '100%',
    minHeight: 50,
    backgroundColor: '#7B2FF7',
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(210, 187, 255, 0.3)',
  },
  applyButtonText: {
    color: '#F5F0FF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
