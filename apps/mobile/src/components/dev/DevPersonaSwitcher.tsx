import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuView } from '@expo/ui/community/menu';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore, DEV_PERSONAS } from '../../features/auth/useAuthStore';
import { Zap } from 'lucide-react-native';

export interface DevPersonaSwitcherProps {
  variant?: 'fab' | 'pill';
  className?: string;
}

export function DevPersonaSwitcher({ variant = 'fab', className }: DevPersonaSwitcherProps) {
  const insets = useSafeAreaInsets();
  const { activePersonaId, loginWithPersona, isDevMode } = useAuthStore(
    useShallow((s) => ({
      activePersonaId: s.activePersonaId,
      loginWithPersona: s.loginWithPersona,
      isDevMode: s.isDevMode,
    }))
  );

  if (!__DEV__ || !isDevMode) return null;

  const currentPersona =
    DEV_PERSONAS.find((p) => p.id === activePersonaId) || DEV_PERSONAS[0]!;

  const actions = DEV_PERSONAS.map((p) => ({
    id: p.id,
    title: `${p.name} (${p.role.toUpperCase()} • ★ ${p.trustScore.toFixed(2)})`,
    state: ((activePersonaId || DEV_PERSONAS[0]!.id) === p.id ? 'on' : 'off') as 'on' | 'off',
  }));

  const trigger =
    variant === 'fab' ? (
      <View
        className={`w-11 h-11 rounded-full bg-ink/95 border border-signal-violet/80 items-center justify-center mb-3 active:bg-ink-raised ${className || ''}`}
        accessibilityLabel={`Dev Persona: ${currentPersona.name}`}
      >
        <Zap size={18} color="#C77DFF" />
        <View
          className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-ink ${
            currentPersona.role === 'host' ? 'bg-signal-violet' : 'bg-pulse-lilac'
          }`}
        />
      </View>
    ) : (
      <View
        style={{ top: Math.max(insets.top + 8, 48) }}
        className={`absolute right-4 z-50 bg-ink-raised border border-signal-violet/80 px-2.5 py-1 rounded-full flex-row items-center ${className || ''}`}
        accessibilityLabel={`Dev Persona: ${currentPersona.name}`}
      >
        <Zap size={11} color="#C77DFF" style={{ marginRight: 4 }} />
        <Text className="text-pulse-lilac text-[11px] font-mono font-bold">
          {currentPersona.name.split(' ')[0]} ({currentPersona.role})
        </Text>
      </View>
    );

  return (
    <MenuView
      title="Dev Persona Switcher"
      shouldOpenOnLongPress={false}
      onPressAction={async ({ nativeEvent }) => {
        if (nativeEvent.event) {
          await loginWithPersona(nativeEvent.event);
        }
      }}
      actions={actions}
    >
      {trigger}
    </MenuView>
  );
}
