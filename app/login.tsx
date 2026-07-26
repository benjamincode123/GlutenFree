import { useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { userFacingError } from '../src/errors/userFacingError';
import { useSmoothKeyboardShift } from '../src/hooks/useSmoothKeyboardShift';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const keyboardShift = useSmoothKeyboardShift(200);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';
  const patternLine = darkenHex(colors.primary, 0.32);
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
      if (isRegister) {
        await signUp(username, password);
      } else {
        await signIn(username, password);
      }
    } catch (err) {
      setError(userFacingError(err, t, isRegister ? 'register_failed' : 'login_failed'));
    } finally {
      setSubmitting(false);
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
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.main}>
            <View style={[styles.card, { backgroundColor: colors.background }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
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
              <AppTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleSubmit}
                returnKeyType="go"
              />

              {error && <ErrorText style={styles.error}>{error}</ErrorText>}

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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isRegister ? t('login.createAccount') : t('login.signIn')}
                  </Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={styles.switchRow}
              onPress={() => {
                setMode(isRegister ? 'login' : 'register');
                setError(null);
              }}
            >
              <Text style={styles.switchText}>
                {isRegister ? t('login.haveAccount') : t('login.noAccount')}
                <Text style={styles.switchLink}>
                  {isRegister ? t('login.signIn') : t('login.register')}
                </Text>
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.poweredBy}>{t('login.poweredBy')}</Text>
            <Text style={styles.copyright}>© {year} Uten Gluten</Text>
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
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    marginTop: 14,
  },
  button: {
    marginTop: 20,
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
