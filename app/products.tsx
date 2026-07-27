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
import { AddToListModal } from '../src/components/AddToListModal';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { GlutenBadge } from '../src/components/GlutenBadge';
import { ErrorText } from '../src/components/ErrorText';
import type { FavoriteProductRef } from '../src/data/authApi';
import {
  loadProductSearchHistory,
  pushProductSearchHistory,
} from '../src/data/productSearchHistory';
import { getProductRepository } from '../src/data/repository';
import { MIN_PRODUCT_SEARCH_CHARS } from '../src/data/searchLimits';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { isUnknownBarcode, Product, ProductCatalog } from '../src/db/types';
import { useTheme } from '../src/theme/ThemeContext';

function canFavoriteProduct(item: Product): item is Product & { catalog: ProductCatalog } {
  return (
    !!item.catalog &&
    item.id > 0 &&
    (item.catalog === 'glutenfri' || item.catalog === 'gluten')
  );
}

export default function ProductsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, addFavorite, removeFavorite } = useAuth();
  const { t, tf } = useI18n();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
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
    async (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length < MIN_PRODUCT_SEARCH_CHARS) {
        setProducts([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const rows = await getProductRepository().searchByName(trimmed, 50);
        setProducts(rows);
        const next = await pushProductSearchHistory(trimmed);
        setRecentSearches(next);
      } catch (err) {
        setProducts([]);
        setError(userFacingError(err, t, 'search_failed'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

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
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('products.hint')}
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
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {products.length === 1
                ? t('products.resultOne')
                : tf('products.results', { count: products.length })}
            </Text>
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
              <Pressable
                style={[styles.row, { backgroundColor: colors.background }]}
                onPress={() => openProduct(item)}
              >
                <View style={styles.rowLine}>
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
                  </View>
                  <GlutenBadge rating={item.glutenRating} />
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
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    marginBottom: 12,
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
