import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { detectGpsProductCountry } from '../src/country/detectProductCountry';
import {
  orderProductCountries,
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
const LOADER_FADE_MS = 220;
const RESULTS_FADE_MS = 300;
/** Avoid flashing a refresh bar on instant responses. */
const REFRESH_BANNER_DELAY_MS = 280;

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
  const [gpsCountry, setGpsCountry] = useState<ProductCountry | null>(null);
  const [countries, setCountries] = useState<ProductCountry[]>(() => [
    ...PRODUCT_COUNTRIES,
  ]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [listProduct, setListProduct] = useState<FavoriteProductRef | null>(null);
  /** Keep the shelf loader mounted while it fades out over results. */
  const [loaderMounted, setLoaderMounted] = useState(false);
  /** Slim banner while previous hits stay visible during a new search. */
  const [showRefreshBanner, setShowRefreshBanner] = useState(false);
  /** Guards against out-of-order search responses overwriting newer results. */
  const searchSeq = useRef(0);
  const hadLoader = useRef(false);
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const resultsOpacity = useRef(new Animated.Value(1)).current;
  const resultsShift = useRef(new Animated.Value(0)).current;

  const queryReady = query.trim().length >= MIN_PRODUCT_SEARCH_CHARS;

  useReliableBackHeader({ title: t('nav.products') });

  useEffect(() => {
    void loadProductSearchHistory().then(setRecentSearches);
  }, []);

  // Prefer the user's GPS country first in search order (and chip order).
  useEffect(() => {
    let cancelled = false;
    void detectGpsProductCountry().then((gps) => {
      if (cancelled || !gps) return;
      setGpsCountry(gps);
      setCountries((prev) => orderProductCountries(prev, gps));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const canGoNext = hasMore;

  // Keep previous results visible while refreshing — only blank the list on
  // first search or after an error. This is what made search feel slower after
  // the shelf loader was added (it replaced the whole list on every keystroke).
  const showResults = queryReady && !error && (products.length > 0 || !loading);
  // AllergnomShelfLoader itself delays 400ms before painting.
  const wantLoader = queryReady && loading && products.length === 0 && !error;
  const refreshingWithResults =
    queryReady && loading && products.length > 0 && !error;

  useEffect(() => {
    if (!refreshingWithResults) {
      setShowRefreshBanner(false);
      return;
    }
    const handle = setTimeout(
      () => setShowRefreshBanner(true),
      REFRESH_BANNER_DELAY_MS
    );
    return () => clearTimeout(handle);
  }, [refreshingWithResults]);

  // Crossfade: fade Allergnom out while the result list fades/slides in.
  useEffect(() => {
    let cancelled = false;
    loaderOpacity.stopAnimation();
    resultsOpacity.stopAnimation();
    resultsShift.stopAnimation();

    if (wantLoader) {
      hadLoader.current = true;
      setLoaderMounted(true);
      loaderOpacity.setValue(0);
      Animated.timing(loaderOpacity, {
        toValue: 1,
        duration: LOADER_FADE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      return () => {
        cancelled = true;
      };
    }

    if (!hadLoader.current) {
      setLoaderMounted(false);
      resultsOpacity.setValue(1);
      resultsShift.setValue(0);
      return () => {
        cancelled = true;
      };
    }

    hadLoader.current = false;
    resultsOpacity.setValue(0);
    resultsShift.setValue(12);
    Animated.parallel([
      Animated.timing(loaderOpacity, {
        toValue: 0,
        duration: LOADER_FADE_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(resultsOpacity, {
        toValue: 1,
        duration: RESULTS_FADE_MS,
        delay: 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(resultsShift, {
        toValue: 0,
        duration: RESULTS_FADE_MS,
        delay: 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !cancelled) setLoaderMounted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [wantLoader, loaderOpacity, resultsOpacity, resultsShift]);

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
            preferredFirst={gpsCountry}
            selected={countries}
            onToggle={(code) =>
              setCountries((prev) =>
                toggleProductCountry(prev, code, gpsCountry)
              )
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

      <View style={styles.resultsArea}>
        {showRefreshBanner ? (
          <View
            style={[
              styles.refreshBanner,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.refreshText, { color: colors.textSecondary }]}>
              {t('products.searching')}
            </Text>
          </View>
        ) : null}

        {showResults ? (
          <Animated.View
            style={[
              styles.resultsFill,
              {
                opacity: resultsOpacity,
                transform: [{ translateY: resultsShift }],
              },
            ]}
          >
            <FlatList
              style={[
                styles.resultsFill,
                refreshingWithResults ? styles.resultsDimmed : null,
              ]}
              contentContainerStyle={styles.content}
              data={products}
              keyExtractor={(item) => `${item.catalog ?? 'x'}-${item.id}-${item.barcode}`}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                products.length > 0 ? (
                  <View style={styles.countRow}>
                    <Text style={[styles.countText, { color: colors.textSecondary }]}>
                      {tf('products.resultsShown', { count: String(products.length) })}
                      {hasMore ? ` · ${t('products.morePages')}` : ''}
                    </Text>
                    <Text style={[styles.countText, { color: colors.textSecondary }]}>
                      {tf('products.pageOnly', { page: String(page) })}
                    </Text>
                  </View>
                ) : null
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
                      {tf('products.pageOnly', { page: String(page) })}
                      {hasMore ? ` · ${t('products.morePages')}` : ''}
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
                    allergenNav={
                      item.catalog && item.id > 0
                        ? { catalog: item.catalog, id: item.id }
                        : null
                    }
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
          </Animated.View>
        ) : null}

        {loaderMounted ? (
          <Animated.View
            style={[styles.loaderOverlay, { opacity: loaderOpacity }]}
            pointerEvents="none"
          >
            <AllergnomShelfLoader label={t('products.searching')} />
          </Animated.View>
        ) : null}
      </View>

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
  resultsArea: {
    flex: 1,
  },
  resultsFill: {
    flex: 1,
  },
  resultsDimmed: {
    opacity: 0.55,
  },
  refreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  refreshText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
