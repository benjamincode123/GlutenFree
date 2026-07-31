import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { AllergenPrefsProvider } from '../src/allergens/AllergenPrefsContext';
import { CountryPrefsProvider } from '../src/country/CountryPrefsContext';
import { KeyboardDismissAccessory } from '../src/components/KeyboardDismissBar';
import { config } from '../src/config';
import { I18nProvider, useI18n } from '../src/i18n/I18nContext';
import { initDatabase } from '../src/db/database';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // When the backend API is active, product data lives in Azure SQL, so there
    // is no local SQLite database to prepare.
    if (config.useBackend) {
      setReady(true);
      void SplashScreen.hideAsync();
      return () => {
        cancelled = true;
      };
    }

    initDatabase()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          void SplashScreen.hideAsync();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError('startup');
          void SplashScreen.hideAsync();
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          The app could not start. Please try again.
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.splashCenter}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={styles.splashLogo}
          resizeMode="contain"
          accessibilityLabel="AltUten"
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AllergenPrefsProvider>
              <CountryPrefsProvider>
                <AuthProvider>
                  <RootNavigator />
                </AuthProvider>
              </CountryPrefsProvider>
            </AllergenPrefsProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, initializing, authEnabled } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing || !authEnabled) {
      return;
    }
    const onLoginScreen = segments[0] === 'login';
    if (!user && !onLoginScreen) {
      router.replace('/login');
    } else if (user && onLoginScreen) {
      router.replace('/');
    }
  }, [user, initializing, authEnabled, segments, router]);

  if (initializing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="login" options={{ title: t('nav.signIn'), headerShown: false }} />
        <Stack.Screen name="index" options={{ title: t('nav.scanner') }} />
        <Stack.Screen name="result" options={{ title: t('nav.result') }} />
        <Stack.Screen name="add" options={{ title: t('nav.add') }} />
        <Stack.Screen name="products" options={{ title: t('nav.products') }} />
        <Stack.Screen name="user" options={{ title: t('nav.profile') }} />
        <Stack.Screen name="favorites" options={{ title: t('favorites.title') }} />
        <Stack.Screen name="lists" options={{ title: t('lists.title') }} />
        <Stack.Screen name="list-detail" options={{ title: t('lists.title') }} />
        <Stack.Screen name="leaderboard" options={{ title: t('nav.leaderboard') }} />
        <Stack.Screen name="admin" options={{ title: t('nav.admin') }} />
        <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
      </Stack>
      <KeyboardDismissAccessory />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  splashCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  splashLogo: {
    width: 240,
    height: 240,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#444',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B3261E',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#B3261E',
    textAlign: 'center',
    fontWeight: '600',
  },
});
