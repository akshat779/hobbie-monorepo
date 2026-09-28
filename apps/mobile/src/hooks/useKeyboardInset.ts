import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Height of the on-screen keyboard, in points, or 0 when it is hidden.
 *
 * iOS: the window does NOT resize when the keyboard opens, so callers must add
 * this inset to lift bottom-pinned content above the keypad.
 * Android: `softwareKeyboardLayoutMode` is `resize`, so the OS already shrinks
 * the window and moves bottom-anchored content; returning 0 here avoids adding
 * the inset twice.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      setHeight(event.endCoordinates?.height ?? 0);
    };
    const onHide = () => setHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return Platform.OS === 'ios' ? height : 0;
}
