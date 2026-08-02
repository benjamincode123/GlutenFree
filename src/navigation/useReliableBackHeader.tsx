import { HeaderBackButton } from '@react-navigation/elements';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect } from 'react';
import { BackHandler } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { goBackOrHome } from './goHome';

type Options = {
  title?: string;
  /**
   * Hide back / disable gestures (e.g. force-save after AI check).
   * When false, always show a working back control that falls back to home
   * if the stack has no history (common after login replace).
   */
  lockExit?: boolean;
};

/**
 * Ensures the header back button always does something useful.
 * Default React Navigation back can appear "stuck" when canGoBack() is false.
 */
export function useReliableBackHeader(options: Options = {}): void {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const { title, lockExit = false } = options;

  const handleBack = useCallback(() => {
    goBackOrHome(router);
  }, [router]);

  useLayoutEffect(() => {
    if (lockExit) {
      navigation.setOptions({
        ...(title !== undefined ? { title } : {}),
        headerBackVisible: false,
        gestureEnabled: false,
        headerLeft: () => null,
      });
      return;
    }

    navigation.setOptions({
      ...(title !== undefined ? { title } : {}),
      // Custom headerLeft replaces the default — keep native back hidden
      // or native-stack shows two back buttons.
      headerBackVisible: false,
      gestureEnabled: true,
      headerLeft: (props) => (
        <HeaderBackButton
          {...props}
          tintColor={colors.text}
          onPress={handleBack}
        />
      ),
    });
  }, [navigation, title, lockExit, colors.text, handleBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (lockExit) return true;
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [lockExit, handleBack]);
}
