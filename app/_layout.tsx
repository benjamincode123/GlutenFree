import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { AllergenPrefsProvider } from '../src/allergens/AllergenPrefsContext';
import { TermsAcceptanceScreen } from '../src/components/TermsAcceptanceScreen';
import { config } from '../src/config';
import { I18nProvider, useI18n } from '../src/i18n/I18nContext';
import { initDatabase } from '../src/db/database';
import { hasAcceptedCurrentTerms } from '../src/legal/termsAcceptance';
import { NotificationPrefsProvider } from '../src/notifications/NotificationPrefsContext';
import { InboxAlertWatcher } from '../src/notifications/InboxAlertWatcher';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

void SplashScreen.preventAutoHideAsync();

const ISSUE_IMAGE = require('../assets/allergnom/allergnomen issue.png');

/** Keep the brand mark on screen long enough to read, then fade it out. */
const MIN_SPLASH_MS = 900;
const SPLASH_FADE_MS = 420;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const finishSplash = () => {
      if (cancelled) return;
      setReady(true);
      // Native splash matches this view — hide it once ours is painted, then fade.
      requestAnimationFrame(() => {
        void SplashScreen.hideAsync();
      });
      const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (cancelled) return;
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: SPLASH_FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) {
            setShowSplash(false);
          }
        });
      }, remaining);
    };

    // When the backend API is active, product data lives in Azure SQL, so there
    // is no local SQLite database to prepare — but we still hold the splash
    // for a short beat so the icon does not flash and vanish.
    if (config.useBackend) {
      finishSplash();
      return () => {
        cancelled = true;
      };
    }

    initDatabase()
      .then(() => {
        if (!cancelled) finishSplash();
      })
      .catch(() => {
        if (!cancelled) {
          setError('startup');
          void SplashScreen.hideAsync();
          setShowSplash(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [splashOpacity]);

  if (error) {
    return (
      <View style={styles.center}>
        <Image
          source={ISSUE_IMAGE}
          style={styles.errorImage}
          resizeMode="contain"
          accessibilityLabel="Allergnom"
        />
        <Text style={styles.errorText}>
          Uff! Allergnomen er blitt dårlig. Prøv igjen senere
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      {ready ? (
        <SafeAreaProvider>
          <ThemeProvider>
            <I18nProvider>
              <AllergenPrefsProvider>
                <AuthProvider>
                  <NotificationPrefsProvider>
                    <InboxAlertWatcher />
                    <RootNavigator />
                  </NotificationPrefsProvider>
                </AuthProvider>
              </AllergenPrefsProvider>
            </I18nProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      ) : (
        <View style={styles.splashCenter}>
          <Image
            source={require('../assets/splash-icon.png')}
            style={styles.splashLogo}
            resizeMode="contain"
            accessibilityLabel="AltUten"
          />
        </View>
      )}

      {showSplash ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.splashOverlay, { opacity: splashOpacity }]}
        >
          <Image
            source={require('../assets/splash-icon.png')}
            style={styles.splashLogo}
            resizeMode="contain"
            accessibilityLabel="AltUten"
          />
        </Animated.View>
      ) : null}
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, initializing, authEnabled } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const segments = useSegments();
  const router = useRouter();
  const [termsReady, setTermsReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** Avoid repeated replace() while a login→home transition is in flight. */
  const authRedirectKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasAcceptedCurrentTerms().then((accepted) => {
      if (!cancelled) {
        setTermsAccepted(accepted);
        setTermsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isLoggedIn = user != null;
  const routeHead = segments[0] ?? '';

  useEffect(() => {
    if (initializing || !authEnabled || !termsAccepted) {
      return;
    }
    const onLoginScreen = routeHead === 'login';
    // Key on login state + route only — not the whole user object (profile
    // background refresh used to re-fire replace('/') in a loop).
    const redirectKey = `${isLoggedIn ? 'in' : 'out'}:${onLoginScreen ? 'login' : 'app'}`;
    if (authRedirectKeyRef.current === redirectKey) {
      return;
    }

    if (!isLoggedIn && !onLoginScreen) {
      authRedirectKeyRef.current = redirectKey;
      router.replace('/login');
    } else if (isLoggedIn && onLoginScreen) {
      authRedirectKeyRef.current = redirectKey;
      router.replace('/');
    } else {
      authRedirectKeyRef.current = redirectKey;
    }
  }, [isLoggedIn, initializing, authEnabled, termsAccepted, routeHead, router]);

  if (initializing || !termsReady) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (!termsAccepted) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <TermsAcceptanceScreen onAccepted={() => setTermsAccepted(true)} />
      </>
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
        <Stack.Screen name="add-choose" options={{ title: t('nav.add') }} />
        <Stack.Screen name="add" options={{ title: t('nav.add') }} />
        <Stack.Screen name="products" options={{ title: t('nav.products') }} />
        <Stack.Screen
          name="product-allergens"
          options={{ title: t('products.allergensTitle') }}
        />
        <Stack.Screen name="user" options={{ title: t('nav.profile') }} />
        <Stack.Screen name="favorites" options={{ title: t('favorites.title') }} />
        <Stack.Screen name="lists" options={{ title: t('lists.title') }} />
        <Stack.Screen name="list-detail" options={{ title: t('lists.title') }} />
        <Stack.Screen name="leaderboard" options={{ title: t('nav.leaderboard') }} />
        <Stack.Screen name="notifications" options={{ title: t('nav.notifications') }} />
        <Stack.Screen name="admin" options={{ title: t('nav.admin') }} />
        <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
      </Stack>
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
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    zIndex: 100,
  },
  splashLogo: {
    width: 320,
    height: 320,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#444',
  },
  errorImage: {
    width: 168,
    height: 112,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#B3261E',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#B3261E',
    textAlign: 'center',
    fontWeight: '600',
  },
});
