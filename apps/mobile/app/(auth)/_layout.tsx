import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthLayout() {
  return (
    <SafeAreaView className="flex-1 bg-void" edges={['top', 'bottom']}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0D0B14' },
        }}
      >
        <Stack.Screen name="phone" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="interests" />
      </Stack>
    </SafeAreaView>
  );
}
