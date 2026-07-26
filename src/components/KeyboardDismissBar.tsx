import { forwardRef, useEffect, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

/** Shared nativeID so every field attaches the same iOS keyboard toolbar. */
export const KEYBOARD_DISMISS_ACCESSORY_ID = 'utenGlutenKeyboardDismiss';

/**
 * TextInput that attaches the shared keyboard “Done” accessory on iOS.
 */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput({ inputAccessoryViewID, ...props }, ref) {
    return (
      <TextInput
        ref={ref}
        {...props}
        inputAccessoryViewID={
          Platform.OS === 'ios'
            ? (inputAccessoryViewID ?? KEYBOARD_DISMISS_ACCESSORY_ID)
            : inputAccessoryViewID
        }
      />
    );
  }
);

/**
 * iOS: native InputAccessoryView glued to the top of the keyboard.
 * Android: matching toolbar flush above the keyboard (no native accessory API).
 */
export function KeyboardDismissAccessory() {
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      return;
    }

    const onShow = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const barBg = isDark ? '#2C2C2E' : '#D1D3D9';
  const border = isDark ? '#3A3A3C' : '#B0B3B8';
  const doneColor = colors.primary;

  const toolbar = (
    <View style={[styles.bar, { backgroundColor: barBg, borderTopColor: border }]}>
      <View style={styles.spacer} />
      <Pressable
        onPress={() => Keyboard.dismiss()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('common.done')}
        style={({ pressed }) => [styles.doneHit, pressed && styles.donePressed]}
      >
        <Text style={[styles.doneText, { color: doneColor }]}>{t('common.done')}</Text>
      </Pressable>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={KEYBOARD_DISMISS_ACCESSORY_ID}>
        {toolbar}
      </InputAccessoryView>
    );
  }

  if (keyboardHeight <= 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.androidWrap, { bottom: keyboardHeight }]}>
      {toolbar}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  spacer: {
    flex: 1,
  },
  doneHit: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  donePressed: {
    opacity: 0.55,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  androidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
});
