import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppFonts } from '../src/hooks/useAppFonts';
import '../global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { fontsLoaded } = useAppFonts();

  if (!fontsLoaded) {
    return <View className="flex-1 bg-void" />;
  }

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
            <Stack.Screen name="activity/[id]" />
            <Stack.Screen name="room/[id]" />
          </Stack>
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
