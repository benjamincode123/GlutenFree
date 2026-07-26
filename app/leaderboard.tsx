import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { getAuthToken } from '../src/auth/session';
import { ErrorText } from '../src/components/ErrorText';
import * as leaderboardApi from '../src/data/leaderboardApi';
import type { LeaderboardEntry, LeaderboardSnapshot } from '../src/data/leaderboardApi';
import {
  getCachedLeaderboardSync,
  saveCachedLeaderboard,
} from '../src/data/leaderboardCache';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

type PeriodKey = 'day' | 'week' | 'month';

export default function LeaderboardScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { authEnabled, user } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useI18n();

  const [period, setPeriod] = useState<PeriodKey>('week');
  const [data, setData] = useState<LeaderboardSnapshot | null>(() =>
    getCachedLeaderboardSync()
  );
  const [loading, setLoading] = useState(() => getCachedLeaderboardSync() == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.leaderboard') });
  }, [navigation, t]);

  const loadFromNetwork = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('unauthorized');
    }
    const snapshot = await leaderboardApi.fetchLeaderboard(token);
    saveCachedLeaderboard(snapshot);
    setData(snapshot);
  }, []);

  // Show cache on open; fetch only when nothing is cached yet.
  useFocusEffect(
    useCallback(() => {
      if (!authEnabled || !user) {
        router.replace('/login');
        return;
      }

      const cached = getCachedLeaderboardSync();
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }

      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          await loadFromNetwork();
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'unauthorized'));
            setData(null);
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
    }, [authEnabled, user, router, t, loadFromNetwork])
  );

  async function handleRefresh() {
    if (!authEnabled) return;
    setRefreshing(true);
    setError(null);
    try {
      await loadFromNetwork();
    } catch (err) {
      setError(userFacingError(err, t, 'unauthorized'));
    } finally {
      setRefreshing(false);
    }
  }

  const entries =
    period === 'day'
      ? data?.day.entries ?? []
      : period === 'week'
        ? data?.week.entries ?? []
        : data?.month.entries ?? [];

  function formatUpdated(iso: string | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(locale === 'nb' ? 'nb-NO' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderRow({ item }: { item: LeaderboardEntry }) {
    const isMe = item.isViewer;
    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: isMe ? colors.primaryMuted : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.rank, { color: colors.textSecondary }]}>#{item.rank}</Text>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {item.isPublic ? item.username : t('leaderboard.anonymous')}
          {isMe ? ` (${t('leaderboard.you')})` : ''}
        </Text>
        <Text style={[styles.xp, { color: colors.primary }]}>+{item.xpGained}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {t('leaderboard.subtitle')}
      </Text>

      <View style={styles.tabs}>
        {(['day', 'week', 'month'] as PeriodKey[]).map((key) => {
          const active = period === key;
          const label =
            key === 'day'
              ? t('leaderboard.day')
              : key === 'week'
                ? t('leaderboard.week')
                : t('leaderboard.month');
          return (
            <Pressable
              key={key}
              onPress={() => setPeriod(key)}
              style={[
                styles.tab,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.onPrimary : colors.text },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {data ? (
        <Text style={[styles.updated, { color: colors.textSecondary }]}>
          {t('leaderboard.updated')}: {formatUpdated(data.generatedAtUtc)}
        </Text>
      ) : null}

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${period}-${item.rank}`}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('leaderboard.empty')}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  subtitle: {
    paddingHorizontal: 20,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  updated: {
    paddingHorizontal: 20,
    fontSize: 12,
    marginBottom: 8,
  },
  error: { marginHorizontal: 20, marginBottom: 8 },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  empty: { marginTop: 24, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  rank: { width: 40, fontSize: 14, fontWeight: '700' },
  username: { flex: 1, fontSize: 15, fontWeight: '600' },
  xp: { fontSize: 15, fontWeight: '800' },
});
