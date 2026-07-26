import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

interface ErrorTextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

/** Shared red error text used for all in-app error messages. */
export function ErrorText({ children, style }: ErrorTextProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.text, { color: colors.danger }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
