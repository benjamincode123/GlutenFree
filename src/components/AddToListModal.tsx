import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getAuthToken } from '../auth/session';
import type { FavoriteProductRef } from '../data/authApi';
import * as listsApi from '../data/listsApi';
import type { ProductListSummary } from '../data/listsApi';
import {
  getCachedListsSync,
  getListsRefreshWaitMs,
  markListsRefreshLimited,
  saveCachedLists,
  upsertCachedList,
} from '../data/listsCache';
import { isAppError } from '../errors/appError';
import { userFacingError } from '../errors/userFacingError';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { AppTextInput } from './KeyboardDismissBar';
import { ErrorText } from './ErrorText';

const SHEET_SLIDE = Math.round(Dimensions.get('window').height * 0.35);

interface AddToListModalProps {
  visible: boolean;
  product: FavoriteProductRef | null;
  onClose: () => void;
  onAdded?: (list: ProductListSummary) => void;
}

export function AddToListModal({
  visible,
  product,
  onClose,
  onAdded,
}: AddToListModalProps) {
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const [lists, setLists] = useState<ProductListSummary[]>(
    () => getCachedListsSync('mine') ?? []
  );
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [modalVisible, setModalVisible] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_SLIDE)).current;

  const loadFromNetwork = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLists([]);
      return;
    }
    const rows = await listsApi.fetchLists(token, 'mine');
    saveCachedLists('mine', rows);
    setLists(rows);
  }, []);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(SHEET_SLIDE);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_SLIDE,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
      }
    });
  }, [visible, backdropOpacity, sheetTranslateY]);

  useEffect(() => {
    if (!visible) {
      setFeedback(null);
      setError(null);
      setBusyId(null);
      setCreating(false);
      setCreateOpen(false);
      setNewName('');
      setKeyboardHeight(0);
      return;
    }

    const cached = getCachedListsSync('mine');
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
        await loadFromNetwork();
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
  }, [visible, t, loadFromNetwork]);

  useEffect(() => {
    if (!visible) return;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  const handleRefresh = async () => {
    const waitMs = getListsRefreshWaitMs('mine');
    if (waitMs > 0) {
      setError(tf('errors.rateLimited', { seconds: Math.ceil(waitMs / 1000) }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loadFromNetwork();
    } catch (err) {
      if (isAppError(err) && err.code === 'rate_limited' && err.retryAfterSeconds) {
        markListsRefreshLimited('mine', err.retryAfterSeconds);
      }
      setError(userFacingError(err, t, 'generic', tf));
    } finally {
      setLoading(false);
    }
  };

  const addTo = async (list: ProductListSummary) => {
    if (!product) return;
    const token = getAuthToken();
    if (!token) return;
    setBusyId(list.id);
    setError(null);
    setFeedback(null);
    try {
      const updated = await listsApi.addProductToList(token, list.id, product);
      upsertCachedList(updated);
      setLists((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setFeedback(t('lists.addedToList'));
      onAdded?.(updated);
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name || !product) return;
    const token = getAuthToken();
    if (!token) return;
    setCreating(true);
    setError(null);
    setFeedback(null);
    try {
      const created = await listsApi.createList(token, name);
      const updated = await listsApi.addProductToList(token, created.id, product);
      upsertCachedList(updated);
      setLists((prev) => {
        const without = prev.filter((row) => row.id !== updated.id);
        return [updated, ...without];
      });
      setCreateOpen(false);
      setNewName('');
      setFeedback(t('lists.addedToList'));
      onAdded?.(updated);
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setCreating(false);
    }
  };

  const alreadyIn = (list: ProductListSummary) =>
    !!product &&
    list.products.some((p) => p.catalog === product.catalog && p.id === product.id);

  return (
    <Modal
      visible={modalVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              maxHeight: keyboardHeight > 0 ? '55%' : '70%',
              paddingBottom: keyboardHeight > 0 ? 12 : 28,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('lists.addToList')}</Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => void handleRefresh()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('lists.myLists')}
              >
                <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
              </Pressable>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
                <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {createOpen ? (
            <View style={styles.createBlock}>
              <AppTextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder={t('lists.namePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                editable={!creating}
              />
              <View style={styles.createActions}>
                <Pressable
                  onPress={() => {
                    setCreateOpen(false);
                    setNewName('');
                    Keyboard.dismiss();
                  }}
                  disabled={creating}
                  style={styles.createBtn}
                >
                  <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleCreateAndAdd()}
                  disabled={creating || !newName.trim()}
                  style={[
                    styles.createBtn,
                    styles.createPrimary,
                    {
                      backgroundColor: colors.primary,
                      opacity: creating || !newName.trim() ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>
                    {creating ? t('common.saving') : t('lists.createAndAdd')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.newListButton, { borderColor: colors.primary }]}
              onPress={() => {
                setCreateOpen(true);
                setError(null);
                setFeedback(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('lists.create')}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
              <Text style={[styles.newListButtonText, { color: colors.primary }]}>
                {t('lists.create')}
              </Text>
            </Pressable>
          )}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null}

          {error ? <ErrorText style={styles.message}>{error}</ErrorText> : null}
          {feedback ? (
            <Text style={[styles.feedback, { color: colors.primary }]}>{feedback}</Text>
          ) : null}

          {!loading && lists.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {t('lists.noListsYet')}
            </Text>
          ) : null}

          <FlatList
            data={lists}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              const inList = alreadyIn(item);
              return (
                <Pressable
                  style={[
                    styles.row,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  disabled={busyId === item.id || inList || creating}
                  onPress={() => void addTo(item)}
                >
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
                      {item.products.length} · {t('lists.products')}
                    </Text>
                  </View>
                  {busyId === item.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name={inList ? 'check-circle' : 'plus-circle-outline'}
                      size={24}
                      color={inList ? colors.primary : colors.textSecondary}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  newListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  newListButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  createBlock: {
    gap: 10,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  createBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createPrimary: {
    minWidth: 120,
    alignItems: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  message: {
    marginBottom: 8,
  },
  feedback: {
    marginBottom: 8,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 13,
  },
});
