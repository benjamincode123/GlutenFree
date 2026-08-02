import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { findUserAllergenHits } from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { getAuthToken } from '../src/auth/session';
import { AllergenBadge } from '../src/components/AllergenBadge';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import * as listsApi from '../src/data/listsApi';
import type { ProductListSummary } from '../src/data/listsApi';
import { upsertCachedList } from '../src/data/listsCache';
import { getProductRepository } from '../src/data/repository';
import { Product } from '../src/db/types';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

type Row = {
  catalog: 'products' | 'products_se' | 'products_dk' | 'products_de';
  id: number;
  product: Product | null;
};

export default function ListDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, tf } = useI18n();
  const { selected: warnAllergens } = useAllergenPrefs();
  const params = useLocalSearchParams<{ id?: string }>();
  const listId = Number.parseInt((params.id ?? '').toString(), 10);

  const [list, setList] = useState<ProductListSummary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharing, setSharing] = useState(false);

  useReliableBackHeader({ title: list?.name ?? t('lists.title') });

  const load = useCallback(async () => {
    if (!Number.isFinite(listId) || listId <= 0) {
      setError(t('lists.notFound'));
      setLoading(false);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await listsApi.fetchList(token, listId);
      setList(detail);
      const repo = getProductRepository();
      const loaded = await Promise.all(
        detail.products.map(async (ref) => {
          try {
            const product = await repo.getById(ref.catalog, ref.id);
            return { catalog: ref.catalog, id: ref.id, product };
          } catch {
            return { catalog: ref.catalog, id: ref.id, product: null };
          }
        })
      );
      setRows(loaded);
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
      setList(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleShare = async () => {
    if (!list) return;
    const username = shareUsername.trim();
    if (!username) return;
    const token = getAuthToken();
    if (!token) return;
    setSharing(true);
    setError(null);
    try {
      const updated = await listsApi.shareList(token, list.id, username);
      upsertCachedList(updated);
      setList(updated);
      setShareOpen(false);
      setShareUsername('');
    } catch (err) {
      setError(userFacingError(err, t, 'generic'));
    } finally {
      setSharing(false);
    }
  };

  const confirmRemoveProduct = (row: Row) => {
    const productName = row.product?.name?.trim() || `${row.catalog} #${row.id}`;
    Alert.alert(
      t('lists.removeItemTitle'),
      tf('lists.removeItemBody', { name: productName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('lists.removeItemConfirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!list) return;
              const token = getAuthToken();
              if (!token) return;
              try {
                const updated = await listsApi.removeProductFromList(token, list.id, {
                  catalog: row.catalog,
                  id: row.id,
                });
                upsertCachedList(updated);
                setList(updated);
                setRows((prev) =>
                  prev.filter((r) => !(r.catalog === row.catalog && r.id === row.id))
                );
              } catch (err) {
                setError(userFacingError(err, t, 'generic'));
              }
            })();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {list ? (
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {tf('lists.ownedBy', { username: list.ownerUsername })}
            {' · '}
            {tf('lists.productCount', { count: list.products.length })}
          </Text>
          {list.sharedUsernames.length > 0 ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {t('lists.sharedWith')}: {list.sharedUsernames.join(', ')}
            </Text>
          ) : null}
          {list.isOwner ? (
            <Pressable
              style={[styles.shareBtn, { borderColor: colors.primary }]}
              onPress={() => {
                setShareUsername('');
                setShareOpen(true);
              }}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color={colors.primary} />
              <Text style={[styles.shareBtnText, { color: colors.primary }]}>{t('lists.share')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.catalog}:${item.id}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary }]}>{t('lists.emptyProducts')}</Text>
        }
        renderItem={({ item }) => {
          const hits = item.product
            ? findUserAllergenHits(
                warnAllergens,
                item.product.allergens,
                item.product.glutenRating
              )
            : [];
          return (
            <Pressable
              style={[styles.row, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => {
                if (!item.product) return;
                router.push({
                  pathname: '/result',
                  params: {
                    id: String(item.product.id),
                    catalog: item.product.catalog ?? item.catalog,
                    barcode: item.product.barcode,
                  },
                });
              }}
            >
              <View style={styles.rowMain}>
                {item.product?.produsent?.trim() ? (
                  <Text style={[styles.produsent, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.product.produsent.trim()}
                  </Text>
                ) : null}
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.product?.name?.trim() || `${item.catalog} #${item.id}`}
                </Text>
                {item.product?.productionCountry?.trim() ? (
                  <Text style={[styles.produsent, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.product.productionCountry.trim()}
                  </Text>
                ) : null}
                {hits.length > 0 ? (
                  <View style={styles.badgeWrap}>
                    {hits.map((hit) => (
                      <AllergenBadge
                        key={`${hit.kind}-${hit.selected}`}
                        name={hit.selected}
                        kind={hit.kind}
                        size="small"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
              <Pressable hitSlop={10} onPress={() => confirmRemoveProduct(item)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {tf('lists.shareTitle', { name: list?.name ?? '' })}
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
              <Pressable onPress={() => setShareOpen(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleShare()}
                disabled={sharing || !shareUsername.trim()}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  meta: { fontSize: 13 },
  shareBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareBtnText: { fontWeight: '700', fontSize: 14 },
  error: { margin: 16 },
  list: { padding: 16, gap: 10 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMain: { flex: 1, gap: 4 },
  produsent: { fontSize: 12, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600' },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { borderRadius: 14, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
