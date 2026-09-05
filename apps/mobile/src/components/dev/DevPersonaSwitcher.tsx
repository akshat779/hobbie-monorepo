import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, DEV_PERSONAS } from '../../features/auth/useAuthStore';
import { Zap, X } from 'lucide-react-native';

export interface DevPersonaSwitcherProps {
  variant?: 'fab' | 'pill';
  className?: string;
}

export function DevPersonaSwitcher({ variant = 'fab', className }: DevPersonaSwitcherProps) {
  const insets = useSafeAreaInsets();
  const { activePersonaId, loginWithPersona, isDevMode } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);

  if (!__DEV__ || !isDevMode) return null;

  const currentPersona =
    DEV_PERSONAS.find((p) => p.id === activePersonaId) || DEV_PERSONAS[0]!;

  return (
    <>
      {variant === 'fab' ? (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className={`w-11 h-11 rounded-full bg-ink/95 border border-signal-violet/80 items-center justify-center mb-3 active:bg-ink-raised ${className || ''}`}
          activeOpacity={0.8}
          accessibilityLabel={`Dev Persona: ${currentPersona.name}`}
        >
          <Zap size={18} color="#C77DFF" />
          <View
            className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-ink ${
              currentPersona.role === 'host' ? 'bg-signal-violet' : 'bg-pulse-lilac'
            }`}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{ top: Math.max(insets.top + 8, 48) }}
          className={`absolute right-4 z-50 bg-ink-raised border border-signal-violet/80 px-2.5 py-1 rounded-full flex-row items-center ${className || ''}`}
          activeOpacity={0.8}
        >
          <Zap size={11} color="#C77DFF" style={{ marginRight: 4 }} />
          <Text className="text-pulse-lilac text-[11px] font-mono font-bold">
            {currentPersona.name.split(' ')[0]} ({currentPersona.role})
          </Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/80 justify-center items-center px-5">
          <View className="w-full max-w-sm bg-ink border border-hairline rounded-3xl p-6">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Zap size={18} color="#C77DFF" />
                <Text className="text-moonlight font-display text-lg font-bold ml-2">
                  Dev Persona Switcher
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="w-8 h-8 rounded-full bg-ink-raised items-center justify-center border border-hairline"
              >
                <X size={14} color="#A99BC2" />
              </TouchableOpacity>
            </View>

            <Text className="text-dusk text-xs mb-4">
              Instantly toggle between multi-user test sessions without SMS auth.
            </Text>

            {DEV_PERSONAS.map((persona) => {
              const isSelected = (activePersonaId || DEV_PERSONAS[0]!.id) === persona.id;
              return (
                <TouchableOpacity
                  key={persona.id}
                  onPress={async () => {
                    await loginWithPersona(persona.id);
                    setModalVisible(false);
                  }}
                  className={`p-3.5 rounded-2xl mb-2.5 border ${
                    isSelected
                      ? 'border-signal-violet bg-signal-violet/15'
                      : 'border-hairline bg-void'
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="text-moonlight font-bold font-display text-sm">
                      {persona.name}
                    </Text>
                    <Text className="text-pulse-lilac font-mono text-xs font-bold">
                      ★ {persona.trustScore.toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-dusk text-xs mt-1">
                    Role: <Text className="text-moonlight font-medium capitalize">{persona.role}</Text> • Interests:{' '}
                    {persona.interests.join(', ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}
