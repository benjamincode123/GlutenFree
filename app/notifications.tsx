import { HeaderBackButton } from '@react-navigation/elements';
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
import { NOTIFICATIONS_PAGE_SIZE } from '../src/data/notificationsApi';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { goBackOrHome } from '../src/navigation/goHome';
import { useTheme } from '../src/theme/ThemeContext';
import { formatApiDateTime } from '../src/time/formatApiDate';

function formatDate(iso: string, locale: string): string {
  return formatApiDateTime(iso, locale);
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { authEnabled, user, removeUnreadMessage } = useAuth();
  const { colors } = useTheme();
  const { t, tf, locale } = useI18n();

  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    goBackOrHome(router);
  }, [router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('nav.notifications'),
      // Always leave this screen — stack history can be empty after replaces,
      // which makes the default header back control appear stuck.
      headerLeft: (props) => (
        <HeaderBackButton
          {...props}
          tintColor={colors.text}
          onPress={handleBack}
        />
      ),
      gestureEnabled: true,
    });
  }, [navigation, t, colors.text, handleBack]);

  const loadInbox = useCallback(async (pageNumber: number) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('unauthorized');
    }
    const inbox = await notificationsApi.fetchNotifications(
      token,
      pageNumber,
      NOTIFICATIONS_PAGE_SIZE
    );
    setItems(inbox.notifications);
    setPage(inbox.page);
    setTotalPages(inbox.totalPages);
    setTotalCount(inbox.totalCount);
  }, []);

  const userId = user?.id ?? null;

  useFocusEffect(
    useCallback(() => {
      if (!authEnabled || userId == null) {
        router.replace('/login');
        return;
      }

      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          await loadInbox(1);
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'unauthorized'));
            setItems([]);
            setTotalCount(0);
            setTotalPages(1);
            setPage(1);
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
      // Intentionally depend on userId (not full user) so mark-as-read →
      // refreshUser() does not re-enter this effect and freeze navigation.
    }, [authEnabled, userId, router, t, loadInbox])
  );

  const goToPage = useCallback(
    async (nextPage: number) => {
      const target = Math.min(totalPages, Math.max(1, nextPage));
      if (target === page || loading) return;
      setLoading(true);
      setError(null);
      try {
        await loadInbox(target);
      } catch (err) {
        setError(userFacingError(err, t, 'unauthorized'));
      } finally {
        setLoading(false);
      }
    },
    [loadInbox, loading, page, t, totalPages]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadInbox(page);
    } catch (err) {
      setError(userFacingError(err, t, 'unauthorized'));
    } finally {
      setRefreshing(false);
    }
  }, [loadInbox, page, t]);

  const markOneRead = useCallback((id: number) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isUnread: false } : n))
    );
    removeUnreadMessage(id);

    const token = getAuthToken();
    if (!token) return;
    // Fire-and-forget — list UI must not wait on this.
    void notificationsApi.markNotificationRead(token, id).catch(() => undefined);
  }, [removeUnreadMessage]);

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
                markOneRead(item.id);
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

      {!loading && totalCount > NOTIFICATIONS_PAGE_SIZE ? (
        <View style={styles.pager}>
          <Pressable
            style={[
              styles.pageBtn,
              { borderColor: colors.border },
              page <= 1 && styles.pageBtnDisabled,
            ]}
            disabled={page <= 1}
            onPress={() => void goToPage(page - 1)}
          >
            <Text style={{ color: colors.text }}>{t('admin.prev')}</Text>
          </Pressable>
          <Text style={[styles.pageLabel, { color: colors.textSecondary }]}>
            {tf('admin.pageOf', { page, total: totalPages })}
          </Text>
          <Pressable
            style={[
              styles.pageBtn,
              { borderColor: colors.border },
              page >= totalPages && styles.pageBtnDisabled,
            ]}
            disabled={page >= totalPages}
            onPress={() => void goToPage(page + 1)}
          >
            <Text style={{ color: colors.text }}>{t('admin.next')}</Text>
          </Pressable>
        </View>
      ) : null}
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
  pager: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
});
