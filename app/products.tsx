import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { findAllergenWarnings } from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { AddToListModal } from '../src/components/AddToListModal';
import { AllergenBadge } from '../src/components/AllergenBadge';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import type { FavoriteProductRef } from '../src/data/authApi';
import {
  loadProductSearchHistory,
  pushProductSearchHistory,
} from '../src/data/productSearchHistory';
import { getProductRepository } from '../src/data/repository';
import {
  MIN_PRODUCT_SEARCH_CHARS,
  PRODUCT_SEARCH_PAGE_SIZE,
} from '../src/data/searchLimits';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { isUnknownBarcode, Product, ProductCatalog } from '../src/db/types';
import { useTheme } from '../src/theme/ThemeContext';

function canFavoriteProduct(item: Product): item is Product & { catalog: ProductCatalog } {
  return (
    !!item.catalog &&
    item.id > 0 &&
    (item.catalog === 'products' ||
      item.catalog === 'glutenfri' ||
      item.catalog === 'gluten')
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, addFavorite, removeFavorite } = useAuth();
  const { t, tf } = useI18n();
  const { colors } = useTheme();
  const { selected: warnAllergens } = useAllergenPrefs();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [listProduct, setListProduct] = useState<FavoriteProductRef | null>(null);

  const queryReady = query.trim().length >= MIN_PRODUCT_SEARCH_CHARS;

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.products') });
  }, [navigation, t]);

  useEffect(() => {
    void loadProductSearchHistory().then(setRecentSearches);
  }, []);

  const runSearch = useCallback(
    async (term: string, pageNumber: number) => {
      const trimmed = term.trim();
      if (trimmed.length < MIN_PRODUCT_SEARCH_CHARS) {
        setProducts([]);
        setHasMore(false);
        setTotalCount(0);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await getProductRepository().searchByName(
          trimmed,
          PRODUCT_SEARCH_PAGE_SIZE,
          { page: pageNumber }
        );
        setProducts(result.items);
        if (result.totalCount != null) {
          setTotalCount(result.totalCount);
        }
        setHasMore(result.hasMore);
        if (pageNumber === 1) {
          const next = await pushProductSearchHistory(trimmed);
          setRecentSearches(next);
        }
      } catch (err) {
        setProducts([]);
        setHasMore(false);
        setTotalCount(0);
        setError(userFacingError(err, t, 'search_failed'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void runSearch(query, page);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, page, runSearch]);

  const openProduct = (item: Product) => {
    if (item.catalog && (isUnknownBarcode(item.barcode) || item.id > 0)) {
      router.push({
        pathname: '/result',
        params: {
          id: String(item.id),
          catalog: item.catalog,
          barcode: item.barcode,
        },
      });
      return;
    }
    router.push({ pathname: '/result', params: { barcode: item.barcode } });
  };

  const openRecentSearch = (term: string) => {
    setPage(1);
    setTotalCount(0);
    setQuery(term);
  };

  const isFavorite = (item: Product) =>
    canFavoriteProduct(item) &&
    (user?.favorites ?? []).some(
      (f) => f.catalog === item.catalog && f.id === item.id
    );

  const toggleFavorite = (item: Product) => {
    if (!user || !canFavoriteProduct(item)) return;
    const ref = { catalog: item.catalog, id: item.id };
    if (isFavorite(item)) {
      void removeFavorite(ref);
    } else {
      void addFavorite(ref);
    }
  };

  const showPager = queryReady && !loading && !error && (page > 1 || hasMore || products.length > 0);
  const shownThrough = products.length === 0 ? 0 : (page - 1) * PRODUCT_SEARCH_PAGE_SIZE + products.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / PRODUCT_SEARCH_PAGE_SIZE));
  const canGoNext =
    totalCount > 0
      ? page * PRODUCT_SEARCH_PAGE_SIZE < totalCount
      : hasMore;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View
        style={[
          styles.searchBlock,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.searchLabel, { color: colors.textSecondary }]}>
          {t('products.searchLabel')}
        </Text>
        <AppTextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.background,
            },
          ]}
          placeholder={t('products.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={(text) => {
            setPage(1);
            setTotalCount(0);
            setQuery(text);
          }}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {tf('products.hint', { min: String(MIN_PRODUCT_SEARCH_CHARS) })}
        </Text>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.emptyBlock}>
          <ErrorText style={styles.errorText}>{error}</ErrorText>
        </View>
      )}

      {!loading && !error && !queryReady && (
        <View style={styles.recentBlock}>
          {recentSearches.length > 0 && (
            <>
              <Text style={[styles.recentTitle, { color: colors.textSecondary }]}>
                {t('products.recentTitle')}
              </Text>
              {recentSearches.map((term) => (
                <Pressable
                  key={term}
                  style={[styles.recentRow, { backgroundColor: colors.background }]}
                  onPress={() => openRecentSearch(term)}
                >
                  <Text style={[styles.recentText, { color: colors.text }]}>{term}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      )}

      {!loading && !error && queryReady && (
        <FlatList
          contentContainerStyle={styles.content}
          data={products}
          keyExtractor={(item) => `${item.catalog ?? 'x'}-${item.id}-${item.barcode}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.countRow}>
              <Text style={[styles.countText, { color: colors.textSecondary }]}>
                {tf('products.resultsProgress', {
                  shown: String(shownThrough),
                  total: String(totalCount),
                })}
              </Text>
              {totalCount > 0 ? (
                <Text style={[styles.countText, { color: colors.textSecondary }]}>
                  {tf('products.pageLabel', {
                    page: String(page),
                    totalPages: String(totalPages),
                  })}
                </Text>
              ) : null}
            </View>
          }
          ListFooterComponent={
            showPager ? (
              <View style={styles.pager}>
                <Pressable
                  style={[
                    styles.pagerButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: page <= 1 ? 0.4 : 1,
                    },
                  ]}
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  accessibilityRole="button"
                  accessibilityLabel={t('products.prevPage')}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={22}
                    color={colors.text}
                  />
                  <Text style={[styles.pagerButtonText, { color: colors.text }]}>
                    {t('products.prevPage')}
                  </Text>
                </Pressable>
                <Text style={[styles.pagerLabel, { color: colors.textSecondary }]}>
                  {tf('products.pageLabel', {
                    page: String(page),
                    totalPages: String(totalPages),
                  })}
                </Text>
                <Pressable
                  style={[
                    styles.pagerButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: canGoNext ? 1 : 0.4,
                    },
                  ]}
                  disabled={!canGoNext}
                  onPress={() => setPage((p) => p + 1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('products.nextPage')}
                >
                  <Text style={[styles.pagerButtonText, { color: colors.text }]}>
                    {t('products.nextPage')}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={colors.text}
                  />
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('products.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const favorited = isFavorite(item);
            const showActions = !!user && canFavoriteProduct(item);
            const warnings = findAllergenWarnings(warnAllergens, item.allergens);
            return (
              <Pressable
                style={[styles.row, { backgroundColor: colors.background }]}
                onPress={() => openProduct(item)}
              >
                <View style={styles.rowMain}>
                  {item.produsent?.trim() ? (
                    <Text
                      style={[styles.produsent, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.produsent.trim()}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.name, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  {item.productionCountry?.trim() ? (
                    <Text
                      style={[styles.country, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.productionCountry.trim()}
                    </Text>
                  ) : null}
                  {warnings.length > 0 ? (
                    <View style={styles.badgeWrap}>
                      {warnings.map((hit) => (
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
                <View style={styles.rowLine}>
                  <Text style={[styles.barcode, { color: colors.textSecondary }]}>
                    {isUnknownBarcode(item.barcode)
                      ? t('products.barcodeUnknown')
                      : item.barcode}
                  </Text>
                  {showActions ? (
                    <View style={styles.actionsCol}>
                      <Pressable
                        style={styles.actionButton}
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setListProduct({ catalog: item.catalog, id: item.id });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('lists.addToList')}
                      >
                        <MaterialCommunityIcons
                          name="playlist-plus"
                          size={22}
                          color={colors.primary}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.actionButton}
                        hitSlop={8}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          toggleFavorite(item);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          favorited
                            ? t('result.removeFavorite')
                            : t('result.addFavorite')
                        }
                      >
                        <MaterialCommunityIcons
                          name={favorited ? 'heart' : 'heart-outline'}
                          size={22}
                          color={favorited ? colors.primary : colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.actionsPlaceholder} />
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <AddToListModal
        visible={listProduct != null}
        product={listProduct}
        onClose={() => setListProduct(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recentBlock: {
    padding: 16,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  recentRow: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentText: {
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 4,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  produsent: {
    fontSize: 12,
    fontWeight: '600',
  },
  country: {
    fontSize: 12,
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 2,
  },
  actionsPlaceholder: {
    width: 52,
    height: 22,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  barcode: {
    flex: 1,
    fontSize: 13,
  },
  pager: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pagerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  pagerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pagerLabel: {
    fontSize: 13,
    fontWeight: '700',
  },

  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
  },
  errorText: {
    textAlign: 'center',
  },
});
