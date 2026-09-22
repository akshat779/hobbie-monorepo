import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { INTEREST_CATEGORIES } from '@hobbie/shared';

interface CategoryFilterBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const CategoryFilterBar = React.memo(function CategoryFilterBar({
  selectedCategory,
  onSelectCategory,
}: CategoryFilterBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row"
      contentContainerStyle={{ paddingRight: 20 }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="All Squads"
        accessibilityState={{ selected: selectedCategory === 'all' }}
        onPress={() => onSelectCategory('all')}
        className={`min-h-[42px] px-4 py-2.5 rounded-full mr-2.5 border items-center justify-center ${
          selectedCategory === 'all'
            ? 'bg-signal-violet border-signal-violet'
            : 'bg-ink border-hairline'
        }`}
        activeOpacity={0.75}
      >
        <Text
          className={`text-xs font-bold font-display ${
            selectedCategory === 'all' ? 'text-moonlight' : 'text-dusk'
          }`}
        >
          All Squads
        </Text>
      </TouchableOpacity>

      {INTEREST_CATEGORIES.map((c) => {
        const isSelected = selectedCategory === c.id;
        return (
          <TouchableOpacity
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelectCategory(c.id)}
            className={`min-h-[42px] px-4 py-2.5 rounded-full mr-2.5 border items-center justify-center ${
              isSelected
                ? 'bg-signal-violet border-signal-violet'
                : 'bg-ink border-hairline'
            }`}
            activeOpacity={0.75}
          >
            <Text
              className={`text-xs font-bold font-display ${
                isSelected ? 'text-moonlight' : 'text-dusk'
              }`}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});
