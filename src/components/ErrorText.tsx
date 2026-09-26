import { ReactNode } from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const ISSUE_IMAGE = require('../../assets/allergnom/allergnomen-issue.png');

interface ErrorTextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Set false when another error illustration is already shown in the same block. */
  illustration?: boolean;
}

/** Shared error message. Allergnom is shown only for server failures. */
export function ErrorText({ children, style, illustration }: ErrorTextProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const text = typeof children === 'string' ? children.trim() : '';
  const showImage = illustration ?? text === t('errors.allergnomDown');
  return (
    <View style={styles.wrap}>
      {showImage ? (
        <Image
          source={ISSUE_IMAGE}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel={t('allergnom.introImageA11y')}
        />
      ) : null}
      <Text style={[styles.text, { color: colors.danger }, style]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  image: {
    width: 168,
    height: 112,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
