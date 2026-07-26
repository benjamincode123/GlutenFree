import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAuthToken } from '../src/auth/session';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import * as listsApi from '../src/data/listsApi';
import type { ProductListSummary } from '../src/data/listsApi';
import {
  getCachedListsSync,
  getListsRefreshWaitMs,
  markListsRefreshLimited,
  removeCachedList,
  saveCachedLists,
  upsertCachedList,
  type ListsScope,
} from '../src/data/listsCache';
import { isAppError } from '../src/errors/appError';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

type Scope = ListsScope;

export default function ListsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t, tf } = useI18n();

  const [scope, setScope] = useState<Scope>('mine');
  const [lists, setLists] = useState<ProductListSummary[]>(
    () => getCachedListsSync('mine') ?? []
  );
  const [loading, setLoading] = useState(() => getCachedListsSync('mine') == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [shareList, setShareList] = useState<ProductListSummary | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [sharing, setSharing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('lists.title') });
  }, [navigation, t]);

  const applyScopeFromCache = useCallback((nextScope: Scope) => {
    const cached = getCachedListsSync(nextScope);
    if (cached) {
      setLists(cached);
      setLoading(false);
      return true;
    }
    setLists([]);
    return false;
  }, []);

  const loadFromNetwork = useCallback(
    async (nextScope: Scope) => {
      const token = getAuthToken();
      if (!token) {
        setLists([]);
        return;
      }
      const rows = await listsApi.fetchLists(token, nextScope);
      saveCachedLists(nextScope, rows);
      setLists(rows);
    },
    []
  );

  // Show buffer on open / tab change; fetch only when that scope has never been loaded.
  useFocusEffect(
    useCallback(() => {
      const cached = getCachedListsSync(scope);
      if (cached) {
        setLists(cached);
        setLoading(false);
        return;
      }

      let cancelled = false;
      (async () => {
        setLoading(true);
        setError(null);
        try {
          await loadFromNetwork(scope);
        } catch (err) {
          if (!cancelled) {
            setError(userFacingError(err, t, 'generic'));
            setLists([]);
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
    }, [scope, t, loadFromNetwork])
  );

  const handleRefresh = async () => {
    const waitMs = getListsRefreshWaitMs(scope);
    if (waitMs > 0) {
      setError(tf('errors.rateLimited', { seconds: Math.ceil(waitMs / 1000) }));
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      await loadFromNetwork(scope);
    } catch (err) {
      if (isAppError(err) && err.code === 'rate_limited' && err.retryAfterSeconds) {
        markListsRefreshLimited(scope, err.retryAfterSeconds);
      }
      setError(userFacingError(err, t, 'generic', tf));
    } finally {
      setRefreshing(false);
    }
  };

  const handleScopeChange = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    setError(null);
    const hasCache = applyScopeFromCache(next);
    if (!hasCache) {
      setLoading(true);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const token = getAuthToken();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const created = await listsApi.createList(token, name);
      upsertCachedList(created);
      setCreateOpen(false);
      setNewName('');
      setScope('mine');
      setLists(getCachedListsSync('mine') ?? [created]);
      setLoading(false);
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setCreating(false);
    }
  };

  const handleShare = async () => {
    if (!shareList) return;
    const username = shareUsername.trim();
    if (!username) return;
    const token = getAuthToken();
    if (!token) return;
    setSharing(true);
    setError(null);
    try {
      const updated = await listsApi.shareList(token, shareList.id, username);
      upsertCachedList(updated);
      setLists((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setShareList(null);
      setShareUsername('');
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setSharing(false);
    }
  };

  const confirmDelete = (item: ProductListSummary) => {
    Alert.alert(t('lists.deleteTitle'), tf('lists.deleteBody', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const token = getAuthToken();
            if (!token) return;
            try {
              await listsApi.deleteList(token, item.id);
              removeCachedList(item.id);
              setLists((prev) => prev.filter((row) => row.id !== item.id));
            } catch (err) {
              setError(userFacingError(err, t, 'generic'));
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable
          style={[styles.tab, scope === 'mine' && { borderBottomColor: colors.primary }]}
          onPress={() => handleScopeChange('mine')}
        >
          <Text
            style={[
              styles.tabText,
              { color: scope === 'mine' ? colors.primary : colors.textSecondary },
            ]}
          >
            {t('lists.myLists')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, scope === 'shared' && { borderBottomColor: colors.primary }]}
          onPress={() => handleScopeChange('shared')}
        >
          <Text
            style={[
              styles.tabText,
              { color: scope === 'shared' ? colors.primary : colors.textSecondary },
            ]}
          >
            {t('lists.sharedLists')}
          </Text>
        </Pressable>
      </View>

      {scope === 'mine' ? (
        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => setCreateOpen(true)}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
          <Text style={[styles.createButtonText, { color: colors.onPrimary }]}>
            {t('lists.create')}
          </Text>
        </Pressable>
      ) : null}

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
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
              {scope === 'mine' ? t('lists.emptyMine') : t('lists.emptyShared')}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() =>
                router.push({ pathname: '/list-detail', params: { id: String(item.id) } })
              }
            >
              <View style={styles.rowMain}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                  {scope === 'shared'
                    ? tf('lists.ownedBy', { username: item.ownerUsername })
                    : null}
                  {scope === 'shared' ? ' · ' : ''}
                  {tf('lists.productCount', { count: item.products.length })}
                  {item.sharedUsernames.length > 0
                    ? ` · ${tf('lists.sharedWithCount', { count: item.sharedUsernames.length })}`
                    : ''}
                </Text>
              </View>
              {item.isOwner ? (
                <Pressable
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setShareUsername('');
                    setShareList(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('lists.share')}
                >
                  <MaterialCommunityIcons name="share-variant" size={22} color={colors.primary} />
                </Pressable>
              ) : null}
              {item.isOwner ? (
                <Pressable
                  hitSlop={10}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    confirmDelete(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} />
                </Pressable>
              ) : null}
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      )}

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('lists.create')}</Text>
            <AppTextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder={t('lists.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCreate()}
                disabled={creating || !newName.trim()}
                style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
                  {creating ? t('common.saving') : t('lists.create')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={shareList != null}
        transparent
        animationType="fade"
        onRequestClose={() => setShareList(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {tf('lists.shareTitle', { name: shareList?.name ?? '' })}
            </Text>
            <AppTextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder={t('lists.shareUsernamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={shareUsername}
              onChangeText={setShareUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShareList(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleShare()}
                disabled={sharing || !shareUsername.trim()}
                style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
                  {sharing ? t('common.saving') : t('lists.share')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
  },
  createButton: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalPrimary: {
    minWidth: 90,
    alignItems: 'center',
  },
});
