import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { AddToListModal } from '../src/components/AddToListModal';
import { AllergnomShelfLoader } from '../src/components/AllergnomShelfLoader';
import { CountrySelector } from '../src/components/CountrySelector';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import {
  ProductCardActions,
  ProductCardIconButton,
  ProductListCard,
} from '../src/components/ProductListCard';
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
import {
  PRODUCT_COUNTRIES,
  toggleProductCountry,
  type ProductCountry,
} from '../src/country/productCountries';
import { useI18n } from '../src/i18n/I18nContext';
import { isUnknownBarcode, Product, ProductCatalog } from '../src/db/types';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

/** Wait for typing to settle before hitting the API. */
const SEARCH_DEBOUNCE_MS = 400;
/** Don't mount the heavy shelf animation for fast responses. */
const LOADER_DELAY_MS = 280;

function canFavoriteProduct(item: Product): item is Product & { catalog: ProductCatalog } {
  return (
    !!item.catalog &&
    item.id > 0 &&
    (item.catalog === 'products' ||
      item.catalog === 'products_se' ||
      item.catalog === 'products_dk' ||
      item.catalog === 'products_de')
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const { user, addFavorite, removeFavorite } = useAuth();
  const { t, tf } = useI18n();
  const { colors } = useTheme();
  const [countries, setCountries] = useState<ProductCountry[]>(() => [
    ...PRODUCT_COUNTRIES,
  ]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [listProduct, setListProduct] = useState<FavoriteProductRef | null>(null);
  /** Guards against out-of-order search responses overwriting newer results. */
  const searchSeq = useRef(0);

  const queryReady = query.trim().length >= MIN_PRODUCT_SEARCH_CHARS;

  useReliableBackHeader({ title: t('nav.products') });

  useEffect(() => {
    void loadProductSearchHistory().then(setRecentSearches);
  }, []);

  // Only show the shelf animation once a search has been in flight long enough
  // that the wait is noticeable — keeps fast lookups feeling instant.
  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }
    const handle = setTimeout(() => setShowLoader(true), LOADER_DELAY_MS);
    return () => clearTimeout(handle);
  }, [loading]);

  const runSearch = useCallback(
    async (term: string, pageNumber: number) => {
      const trimmed = term.trim();
      // Debouncing only cancels searches that have not started yet. Once a
      // request is in flight nothing stops it, so a slow earlier response can
      // land after a newer one and show results for a term you already
      // replaced. Only the most recent request is allowed to write state.
      const seq = ++searchSeq.current;
      const isStale = () => seq !== searchSeq.current;

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
          { page: pageNumber, countries }
        );
        if (isStale()) return;
        setProducts(result.items);
        if (result.totalCount != null) {
          setTotalCount(result.totalCount);
        }
        setHasMore(result.hasMore);
        if (pageNumber === 1) {
          const next = await pushProductSearchHistory(trimmed);
          if (isStale()) return;
          setRecentSearches(next);
        }
      } catch (err) {
        if (isStale()) return;
        setProducts([]);
        setHasMore(false);
        setTotalCount(0);
        setError(userFacingError(err, t, 'search_failed'));
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [t, countries]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void runSearch(query, page);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, page, runSearch]);

  const countriesKey = countries.join(',');
  useEffect(() => {
    setPage(1);
    setTotalCount(0);
  }, [countriesKey]);

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

  const showPager = queryReady && !error && (page > 1 || hasMore || products.length > 0);
  const shownThrough = products.length === 0 ? 0 : (page - 1) * PRODUCT_SEARCH_PAGE_SIZE + products.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, 1) / PRODUCT_SEARCH_PAGE_SIZE));
  const canGoNext =
    totalCount > 0
      ? page * PRODUCT_SEARCH_PAGE_SIZE < totalCount
      : hasMore;

  // Keep previous results visible while refreshing — only blank the list on
  // first search or after an error. This is what made search feel slower after
  // the shelf loader was added (it replaced the whole list on every keystroke).
  const showResults = queryReady && !error && (products.length > 0 || !loading);
  const showCenteredLoader = queryReady && showLoader && products.length === 0 && !error;

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
        <View style={styles.countryRow}>
          <CountrySelector
            compact
            selected={countries}
            onToggle={(code) =>
              setCountries((prev) => toggleProductCountry(prev, code))
            }
          />
        </View>
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

      {showCenteredLoader && (
        <View style={styles.centered}>
          <AllergnomShelfLoader label={t('products.searching')} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.emptyBlock}>
          <ErrorText style={styles.errorText}>{error}</ErrorText>
        </View>
      )}

      {!queryReady && (
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

      {showResults && (
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
                      opacity: page <= 1 || loading ? 0.4 : 1,
                    },
                  ]}
                  disabled={page <= 1 || loading}
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
                      opacity: canGoNext && !loading ? 1 : 0.4,
                    },
                  ]}
                  disabled={!canGoNext || loading}
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
            return (
              <ProductListCard
                product={item}
                fallbackTitle={item.name}
                onPress={() => openProduct(item)}
                trailing={
                  showActions ? (
                    <ProductCardActions>
                      <ProductCardIconButton
                        name="playlist-plus"
                        color={colors.primary}
                        label={t('lists.addToList')}
                        onPress={() =>
                          setListProduct({ catalog: item.catalog, id: item.id })
                        }
                      />
                      <ProductCardIconButton
                        name={favorited ? 'heart' : 'heart-outline'}
                        color={favorited ? colors.primary : colors.textSecondary}
                        label={
                          favorited
                            ? t('result.removeFavorite')
                            : t('result.addFavorite')
                        }
                        onPress={() => toggleFavorite(item)}
                      />
                    </ProductCardActions>
                  ) : undefined
                }
              />
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
  countryRow: {
    marginBottom: 10,
    alignItems: 'flex-start',
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
