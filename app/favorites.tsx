import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/auth/AuthContext';
import { AppTextInput } from '../src/components/KeyboardDismissBar';
import { ErrorText } from '../src/components/ErrorText';
import { GlutenBadge } from '../src/components/GlutenBadge';
import type { FavoriteProductRef } from '../src/data/authApi';
import { getProductRepository } from '../src/data/repository';
import { Product } from '../src/db/types';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

type FavoriteRow = {
  ref: FavoriteProductRef;
  product: Product | null;
};

export default function FavoritesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const favorites = user?.favorites ?? [];
  const favoritesKey = JSON.stringify(favorites);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('favorites.title') });
  }, [navigation, t]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const refs: FavoriteProductRef[] = (() => {
        try {
          return JSON.parse(favoritesKey) as FavoriteProductRef[];
        } catch {
          return [];
        }
      })();

      async function load() {
        if (refs.length === 0) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
            setError(null);
          }
          return;
        }

        setLoading(true);
        setError(null);
        try {
          const repo = getProductRepository();
          const loaded = await Promise.all(
            refs.map(async (ref) => {
              try {
                const product = await repo.getById(ref.catalog, ref.id);
                return { ref, product };
              } catch {
                return { ref, product: null };
              }
            })
          );
          if (!cancelled) {
            setRows(loaded);
          }
        } catch (err) {
          if (!cancelled) {
            setRows([]);
            setError(userFacingError(err, t, 'lookup_failed'));
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      void load();
      return () => {
        cancelled = true;
      };
    }, [favoritesKey, t])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = row.product?.name?.toLowerCase() ?? '';
      const barcode = row.product?.barcode?.toLowerCase() ?? '';
      return name.includes(q) || barcode.includes(q);
    });
  }, [rows, query]);

  const openProduct = (row: FavoriteRow) => {
    if (row.product) {
      router.push({
        pathname: '/result',
        params: {
          id: String(row.product.id),
          catalog: row.product.catalog ?? row.ref.catalog,
          barcode: row.product.barcode,
        },
      });
      return;
    }
    router.push({
      pathname: '/result',
      params: {
        id: String(row.ref.id),
        catalog: row.ref.catalog,
      },
    });
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
        <AppTextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.background,
            },
          ]}
          placeholder={t('favorites.searchPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {t('favorites.loading')}
          </Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.emptyBlock}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}

      {!loading && !error && favorites.length === 0 && (
        <View style={styles.emptyBlock}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {t('favorites.empty')}
          </Text>
        </View>
      )}

      {!loading && !error && favorites.length > 0 && filtered.length === 0 && (
        <View style={styles.emptyBlock}>
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            {t('favorites.noneMatch')}
          </Text>
        </View>
      )}

      {!loading && !error && filtered.length > 0 && (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.ref.catalog}:${item.ref.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.row,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
              onPress={() => openProduct(item)}
            >
              <View style={styles.rowMain}>
                {item.product?.produsent?.trim() ? (
                  <Text
                    style={[styles.produsent, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.product.produsent.trim()}
                  </Text>
                ) : null}
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.product?.name?.trim() ||
                    `${item.ref.catalog} #${item.ref.id}`}
                </Text>
                {item.product ? (
                  <View style={styles.badgeWrap}>
                    <GlutenBadge rating={item.product.glutenRating} size="small" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyBlock: {
    padding: 24,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rowMain: {
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  produsent: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
  },
});
