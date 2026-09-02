import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal, X, Check, MapPin, Users, UserCheck } from 'lucide-react-native';
import { RadiusSlider } from '../../components/common/RadiusSlider';
import {
  AgeGroupOption,
  DiscoveryFiltersState,
  GenderFilterOption,
} from './types';

interface DiscoveryFilterModalProps {
  visible: boolean;
  filters: DiscoveryFiltersState;
  onApplyFilters: (filters: DiscoveryFiltersState) => void;
  onClose: () => void;
  totalSquadsCount?: number;
}

const GENDER_OPTIONS: { id: GenderFilterOption; label: string; desc: string }[] = [
  { id: 'all', label: 'All Genders', desc: 'Open to everyone' },
  { id: 'women_only', label: 'Women Only', desc: 'Safe spaces for women' },
  { id: 'men_only', label: 'Men Only', desc: 'Men-only groups' },
  { id: 'coed', label: 'Co-ed Squads', desc: 'Mixed group activities' },
];

const AGE_OPTIONS: { id: AgeGroupOption; label: string; desc: string }[] = [
  { id: 'all', label: 'All Ages (18+)', desc: 'Any adult age' },
  { id: '18_24', label: '18 – 24 yrs', desc: 'College & early career' },
  { id: '25_34', label: '25 – 34 yrs', desc: 'Young professionals' },
  { id: '35_plus', label: '35+ yrs', desc: 'Experienced & seasoned' },
];

export function DiscoveryFilterModal({
  visible,
  filters,
  onApplyFilters,
  onClose,
  totalSquadsCount = 0,
}: DiscoveryFilterModalProps) {
  const insets = useSafeAreaInsets();

  const [localRadius, setLocalRadius] = useState<number>(filters.radiusKm);
  const [localGender, setLocalGender] = useState<GenderFilterOption>(filters.gender);
  const [localAge, setLocalAge] = useState<AgeGroupOption>(filters.ageGroup);

  // Sync state when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalRadius(filters.radiusKm);
      setLocalGender(filters.gender);
      setLocalAge(filters.ageGroup);
    }
  }, [visible, filters]);

  const handleReset = () => {
    setLocalRadius(4.5);
    setLocalGender('all');
    setLocalAge('all');
  };

  const handleApply = () => {
    onApplyFilters({
      radiusKm: localRadius,
      gender: localGender,
      ageGroup: localAge,
    });
    onClose();
  };

  const hasActiveFilters =
    localRadius !== 4.5 || localGender !== 'all' || localAge !== 'all';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/75 justify-end">
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: '85%',
          }}
          className="bg-ink border-t border-hairline rounded-t-3xl px-6 pt-4"
        >
          {/* Header Bar */}
          <View className="flex-row items-center justify-between pb-4 border-b border-hairline/60">
            <View className="flex-row items-center">
              <SlidersHorizontal size={18} color="#C77DFF" style={{ marginRight: 8 }} />
              <Text className="text-moonlight font-display text-lg font-bold">
                Discovery Filters
              </Text>
            </View>

            <View className="flex-row items-center space-x-3">
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleReset} activeOpacity={0.7} className="mr-3">
                  <Text className="text-pulse-lilac font-display text-xs font-semibold">
                    Reset All
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-ink-raised border border-hairline items-center justify-center"
                activeOpacity={0.7}
              >
                <X size={14} color="#A99BC2" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="py-4"
          >
            {/* Section 1: Interactive Drag Slider (1km to 50km+ Global) */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                  <MapPin size={14} color="#C77DFF" style={{ marginRight: 6 }} />
                  <Text className="text-moonlight font-display text-sm font-bold">
                    Discovery Radius
                  </Text>
                </View>
              </View>

              <Text className="text-dusk font-body text-xs mb-2">
                Drag slider knob left or right to tune distance or discover virtual/gaming squads across the city.
              </Text>

              <RadiusSlider
                value={localRadius}
                onChange={setLocalRadius}
                min={1}
                max={50}
                step={0.5}
              />
            </View>

            {/* Section 2: Target Gender Preference */}
            <View className="mb-6">
              <View className="flex-row items-center mb-2">
                <UserCheck size={14} color="#C77DFF" style={{ marginRight: 6 }} />
                <Text className="text-moonlight font-display text-sm font-bold">
                  Gender Preference
                </Text>
              </View>

              <Text className="text-dusk font-body text-xs mb-3">
                Filter activities based on host audience specification.
              </Text>

              <View className="space-y-2">
                {GENDER_OPTIONS.map((g) => {
                  const isSelected = localGender === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setLocalGender(g.id)}
                      className={`p-3 rounded-2xl border flex-row items-center justify-between ${
                        isSelected
                          ? 'bg-signal-violet/15 border-signal-violet'
                          : 'bg-void border-hairline'
                      }`}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text
                          className={`font-display text-xs font-bold ${
                            isSelected ? 'text-moonlight' : 'text-dusk'
                          }`}
                        >
                          {g.label}
                        </Text>
                        <Text className="text-dusk/70 text-[11px] mt-0.5">
                          {g.desc}
                        </Text>
                      </View>

                      {isSelected && (
                        <View className="w-5 h-5 rounded-full bg-signal-violet items-center justify-center">
                          <Check size={11} color="#F5F0FF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 3: Age Group Filter */}
            <View className="mb-6">
              <View className="flex-row items-center mb-2">
                <Users size={14} color="#C77DFF" style={{ marginRight: 6 }} />
                <Text className="text-moonlight font-display text-sm font-bold">
                  Age Demographic
                </Text>
              </View>

              <Text className="text-dusk font-body text-xs mb-3">
                Match with squads in your preferred peer group.
              </Text>

              <View className="space-y-2">
                {AGE_OPTIONS.map((a) => {
                  const isSelected = localAge === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setLocalAge(a.id)}
                      className={`p-3 rounded-2xl border flex-row items-center justify-between ${
                        isSelected
                          ? 'bg-signal-violet/15 border-signal-violet'
                          : 'bg-void border-hairline'
                      }`}
                      activeOpacity={0.75}
                    >
                      <View>
                        <Text
                          className={`font-display text-xs font-bold ${
                            isSelected ? 'text-moonlight' : 'text-dusk'
                          }`}
                        >
                          {a.label}
                        </Text>
                        <Text className="text-dusk/70 text-[11px] mt-0.5">
                          {a.desc}
                        </Text>
                      </View>

                      {isSelected && (
                        <View className="w-5 h-5 rounded-full bg-signal-violet items-center justify-center">
                          <Check size={11} color="#F5F0FF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action CTA */}
          <TouchableOpacity
            onPress={handleApply}
            className="w-full bg-signal-violet py-4 rounded-full items-center justify-center shadow-lg mt-2"
            activeOpacity={0.85}
          >
            <Text className="text-moonlight font-display text-base font-bold">
              Apply Filters ({totalSquadsCount} Available)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
