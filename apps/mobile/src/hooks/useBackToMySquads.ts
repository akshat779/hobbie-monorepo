import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * Returns to the My Squads tab using a **pop** transition.
 *
 * Convention: a back/return action must animate in the opposite direction to
 * the forward navigation that opened the screen. `router.replace()` animates
 * forward (right-to-left), so any screen entered by push/replace should exit
 * via `router.dismissTo()` (reverse) when the stack supports it, falling back
 * to `replace` only when there is nothing to dismiss.
 *
 * `dismissTo` uses the native stack pop animation, which react-native-screens
 * implements on both iOS and Android.
 */
export function useBackToMySquads() {
  const router = useRouter();

  return useCallback(() => {
    if (router.canDismiss()) {
      router.dismissTo('/(main)/my-activities');
    } else {
      router.replace('/(main)/my-activities');
    }
  }, [router]);
}
