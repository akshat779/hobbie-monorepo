import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, AppStateStatus, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AnimatedSplash } from '../src/components/common/AnimatedSplash';
import { useAppFonts } from '../src/hooks/useAppFonts';
import { useAuthStore } from '../src/features/auth/useAuthStore';
import '../global.css';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Wire TanStack Query focus management to React Native native AppState
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      handleFocus(status === 'active');
    }
  });
  return () => {
    subscription.remove();
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes cache garbage collection
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export default function RootLayout() {
  const { fontsLoaded, fontError } = useAppFonts();
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  const appReady = fontsLoaded || fontError != null;
  const handleSplashFinish = useCallback(() => setSplashFinished(true), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <View className="flex-1 bg-void">
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0D0B14' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(main)" />
            <Stack.Screen
              name="activity/create"
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen
              name="filters"
              options={{
                presentation: 'formSheet',
                sheetAllowedDetents: [0.82, 0.95],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: '#17131F' },
              }}
            />
            <Stack.Screen name="activity/[id]" />
            <Stack.Screen name="room/[id]" />
          </Stack>
          {splashFinished ? null : (
            <AnimatedSplash ready={appReady} onFinish={handleSplashFinish} />
          )}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
