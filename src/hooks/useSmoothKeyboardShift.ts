import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardEvent,
  Platform,
} from 'react-native';

/** iOS keyboard curve approximation — keeps shift in sync with the system animation. */
const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.4, 0.99);

/**
 * Smooth translateY offset that tracks the keyboard (native driver).
 * Prefer this over KeyboardAvoidingView for centered login-style layouts.
 */
export function useSmoothKeyboardShift(maxShift = 220) {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateTo = (toValue: number, duration: number) => {
      Animated.timing(shift, {
        toValue,
        duration: duration > 0 ? duration : Platform.OS === 'ios' ? 250 : 260,
        easing: KEYBOARD_EASING,
        useNativeDriver: true,
      }).start();
    };

    const shiftForHeight = (keyboardHeight: number) => {
      if (keyboardHeight <= 0) {
        return 0;
      }
      // Move form up enough to clear the keyboard without slamming into the top.
      return -Math.min(keyboardHeight * 0.48, maxShift);
    };

    if (Platform.OS === 'ios') {
      const onFrame = (event: KeyboardEvent) => {
        const windowH = Dimensions.get('window').height;
        const keyboardHeight = Math.max(0, windowH - event.endCoordinates.screenY);
        animateTo(shiftForHeight(keyboardHeight), event.duration);
      };

      const sub = Keyboard.addListener('keyboardWillChangeFrame', onFrame);
      return () => sub.remove();
    }

    const onShow = Keyboard.addListener('keyboardDidShow', (event: KeyboardEvent) => {
      animateTo(shiftForHeight(event.endCoordinates.height), 280);
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      animateTo(0, 240);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [maxShift, shift]);

  return shift;
}
