import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { getAuthToken } from '../src/auth/session';
import { ErrorText } from '../src/components/ErrorText';
import * as notificationsApi from '../src/data/notificationsApi';
import type { UserNotificationItem } from '../src/data/notificationsApi';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale === 'nb' ? 'nb-NO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { authEnabled, user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.notifications') });
  }, [navigation, t]);

  const loadInbox = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('unauthorized');
    }
    const inbox = await notificationsApi.fetchNotifications(token, 50);
    setItems(inbox.notifications);

    // Opening the inbox counts as seeing the messages — clear unread badge.
    if (inbox.unreadCount > 0) {
      await notificationsApi.markAllNotificationsRead(token);
      setItems((prev) => prev.map((n) => ({ ...n, isUnread: false })));
      await refreshUser();
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      if (!authEnabled || !user) {
        router.replace('/login');
        return;
      }

      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          await loadInbox();
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'unauthorized'));
            setItems([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [authEnabled, user, router, t, loadInbox])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadInbox();
    } catch (err) {
      setError(userFacingError(err, t, 'unauthorized'));
    } finally {
      setRefreshing(false);
    }
  }, [loadInbox, t]);

  const markOneRead = useCallback(
    async (id: number) => {
      if (busyId != null) return;
      setBusyId(id);
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error('unauthorized');
        }
        await notificationsApi.markNotificationRead(token, id);
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isUnread: false } : n))
        );
        await refreshUser();
      } catch (err) {
        setError(userFacingError(err, t, 'unauthorized'));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, refreshUser, t]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
      }
    >
      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('notifications.empty')}
        </Text>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (item.isUnread) {
                void markOneRead(item.id);
              }
            }}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: item.isUnread ? colors.primary : colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              {item.isUnread ? (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
            <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>
            {item.imageUrl?.trim() ? (
              <Image
                source={{ uri: item.imageUrl.trim() }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : null}
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {formatDate(item.createdAt, locale)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  error: { marginBottom: 12 },
  loader: { marginTop: 32 },
  empty: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F5F6F8',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
});
