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
        onPress={() => onSelectCategory('all')}
        className={`px-4 py-2 rounded-full mr-2 border ${
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
            onPress={() => onSelectCategory(c.id)}
            className={`px-4 py-2 rounded-full mr-2 border ${
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
