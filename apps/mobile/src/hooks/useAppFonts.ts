import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    'Bricolage-Grotesque': BricolageGrotesque_600SemiBold,
    'Bricolage-Grotesque-Regular': BricolageGrotesque_400Regular,
    'Bricolage-Grotesque-Medium': BricolageGrotesque_500Medium,
    'Bricolage-Grotesque-SemiBold': BricolageGrotesque_600SemiBold,
    'Bricolage-Grotesque-Bold': BricolageGrotesque_700Bold,
    'JetBrains-Mono': JetBrainsMono_500Medium,
    'JetBrains-Mono-Regular': JetBrainsMono_400Regular,
    'JetBrains-Mono-Bold': JetBrainsMono_700Bold,
  });

  return { fontsLoaded, fontError };
}
