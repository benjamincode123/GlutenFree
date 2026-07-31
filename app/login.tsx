import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import {
  darkenHex,
  GroceryPatternBackground,
} from '../src/components/GroceryPatternBackground';
import { config } from '../src/config';
import { userFacingError } from '../src/errors/userFacingError';
import { useSmoothKeyboardShift } from '../src/hooks/useSmoothKeyboardShift';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

function registerWebUrl(): string {
  return config.registerUrl;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const keyboardShift = useSmoothKeyboardShift(200);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pattern strokes need contrast on primary: lighten on black, darken on white.
  const patternLine = isDark ? darkenHex(colors.primary, 0.14) : '#2A2E35';
  const year = new Date().getFullYear();

  async function handleSubmit() {
    setError(null);
    if (username.trim().length < 3) {
      setError(t('login.usernameShort'));
      return;
    }
    if (password.length < 6) {
      setError(t('login.passwordShort'));
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(userFacingError(err, t, 'login_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function openRegisterWebsite() {
    setError(null);
    const url = registerWebUrl();
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setError(t('login.registerOpenFailed'));
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError(t('login.registerOpenFailed'));
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.primary }]}>
      <GroceryPatternBackground
        backgroundColor={colors.primary}
        lineColor={patternLine}
      />
      <Animated.View
        style={[
          styles.flex,
          {
            transform: [{ translateY: keyboardShift }],
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.main}>
            <View style={[styles.card, { backgroundColor: colors.background }]}>
              <Text style={[styles.label, styles.labelFirst, { color: colors.textSecondary }]}>
                {t('login.username')}
              </Text>
              <AppTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t('login.usernamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('login.password')}
              </Text>
              <View
                style={[
                  styles.passwordRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppTextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder={t('login.passwordPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="go"
                />
                <Pressable
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t('login.hidePassword') : t('login.showPassword')
                  }
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

              <Pressable
                style={[
                  styles.button,
                  { backgroundColor: colors.primary },
                  submitting && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                    {t('login.signIn')}
                  </Text>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.switchRow} onPress={openRegisterWebsite}>
              <Text style={[styles.switchText, { color: colors.onPrimary }]}>
                {t('login.noAccount')}
                <Text style={[styles.switchLink, { color: colors.onPrimary }]}>
                  {t('login.register')}
                </Text>
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.poweredBy, { color: colors.onPrimary }]}>
              {t('login.poweredBy')}
            </Text>
            <Text style={[styles.copyright, { color: colors.onPrimary, opacity: 0.75 }]}>
              © {year} AltUten
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  main: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  labelFirst: {
    marginTop: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordRow: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 14,
    marginTop: 14,
  },
  button: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  switchRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#EAF7EF',
    fontSize: 15,
  },
  switchLink: {
    color: '#fff',
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
  },
  poweredBy: {
    color: '#EAF7EF',
    fontSize: 13,
    fontWeight: '600',
  },
  copyright: {
    color: '#CDEAD6',
    fontSize: 12,
    marginTop: 4,
  },
});
