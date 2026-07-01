import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { config } from '../src/config';
import { initDatabase } from '../src/db/database';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // When the backend API is active, product data lives in Azure SQL, so there
    // is no local SQLite database to prepare.
    if (config.useBackend) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    initDatabase()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize database.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Database error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B7F3B" />
        <Text style={styles.loadingText}>Preparing gluten database...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, initializing, authEnabled } = useAuth();
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B7F3B" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1B7F3B' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'Gluten Scanner' }} />
      <Stack.Screen name="result" options={{ title: 'Scan Result' }} />
      <Stack.Screen name="add" options={{ title: 'Add Product' }} />
      <Stack.Screen name="products" options={{ title: 'All Products' }} />
    </Stack>
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
    color: '#444',
    textAlign: 'center',
  },
});
