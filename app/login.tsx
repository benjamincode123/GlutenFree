import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  async function handleSubmit() {
    setError(null);

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await signUp(username, password);
      } else {
        await signIn(username, password);
      }
      // On success, the root navigator redirects away from this screen.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>Gluten Scanner</Text>
        <Text style={styles.subtitle}>
          {isRegister ? 'Create an account to get started' : 'Sign in to continue'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Your username"
            placeholderTextColor="#9AA0A6"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#9AA0A6"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegister ? 'Create account' : 'Sign in'}
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
            {isRegister
              ? 'Already have an account? '
              : "Don't have an account? "}
            <Text style={styles.switchLink}>
              {isRegister ? 'Sign in' : 'Register'}
            </Text>
          </Text>
        </Pressable>

        <Text style={styles.note}>
          New accounts are standard users. Ask an admin to upgrade you if you need
          to add products.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1B7F3B' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#DDF3E4',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3C4043',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F6F8',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#202124',
  },
  error: {
    color: '#B3261E',
    fontSize: 14,
    marginTop: 14,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1B7F3B',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#7FB894',
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
  note: {
    color: '#CDEAD6',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
