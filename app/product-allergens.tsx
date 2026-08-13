import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AllergenBadge } from '../src/components/AllergenBadge';
import { ErrorText } from '../src/components/ErrorText';
import { getProductRepository } from '../src/data/repository';
import { Product, ProductCatalog } from '../src/db/types';
import { userFacingError } from '../src/errors/userFacingError';
import { useI18n } from '../src/i18n/I18nContext';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

function isCatalog(value: string): value is ProductCatalog {
  return (
    value === 'products' ||
    value === 'products_se' ||
    value === 'products_dk' ||
    value === 'products_de'
  );
}

/** Full allergen declaration for a product — opened from truncated search cards. */
export default function ProductAllergensScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    catalog?: string;
    name?: string;
  }>();
  const id = Number.parseInt((params.id ?? '').toString(), 10);
  const catalogRaw = (params.catalog ?? '').toString();
  const catalog = isCatalog(catalogRaw) ? catalogRaw : null;
  const titleHint = (params.name ?? '').toString().trim();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useReliableBackHeader({
    title: t('products.allergensTitle'),
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!catalog || !Number.isFinite(id) || id <= 0) {
        setError(t('result.lookupFailed'));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const found = await getProductRepository().getById(catalog, id);
        if (cancelled) return;
        if (!found) {
          setProduct(null);
          setError(t('result.lookupFailed'));
        } else {
          setProduct(found);
        }
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setError(userFacingError(err, t, 'lookup_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [catalog, id, t]);

  const contains = product?.allergens?.inneholder?.filter(Boolean) ?? [];
  const mayContain = product?.allergens?.kanInneholde?.filter(Boolean) ?? [];
  const free = product?.allergens?.inneholderIkke?.filter(Boolean) ?? [];
  const hasAny = contains.length + mayContain.length + free.length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.productName, { color: colors.text }]}>
        {product?.name?.trim() || titleHint || t('products.allergensTitle')}
      </Text>
      {product?.produsent?.trim() ? (
        <Text style={[styles.produsent, { color: colors.textSecondary }]}>
          {product.produsent.trim()}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

      {!loading && error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      {!loading && !error && product ? (
        <View style={styles.sections}>
          <AllergenSection
            title={t('result.allergensContainsLabel')}
            empty={t('products.allergensSectionEmpty')}
            names={contains}
            kind="contains"
          />
          <AllergenSection
            title={t('result.allergensMayContainLabel')}
            empty={t('products.allergensSectionEmpty')}
            names={mayContain}
            kind="mayContain"
          />
          <AllergenSection
            title={t('result.allergensFreeLabel')}
            empty={t('products.allergensSectionEmpty')}
            names={free}
            kind="free"
          />
          {!hasAny ? (
            <Text style={[styles.emptyAll, { color: colors.textSecondary }]}>
              {t('result.allergensNone')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function AllergenSection({
  title,
  empty,
  names,
  kind,
}: {
  title: string;
  empty: string;
  names: string[];
  kind: 'contains' | 'mayContain' | 'free';
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {names.length === 0 ? (
        <Text style={[styles.emptySection, { color: colors.textSecondary }]}>
          {empty}
        </Text>
      ) : (
        <View style={styles.badgeWrap}>
          {names.map((name) => (
            <AllergenBadge
              key={`${kind}-${name}`}
              name={name}
              kind={kind}
              size="large"
              showKindPrefix={false}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  productName: { fontSize: 22, fontWeight: '800' },
  produsent: { fontSize: 14, fontWeight: '600', marginTop: -4 },
  center: { paddingVertical: 40, alignItems: 'center' },
  error: { marginTop: 12 },
  sections: { gap: 12, marginTop: 8 },
  section: { borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emptySection: { fontSize: 14, lineHeight: 20 },
  emptyAll: { fontSize: 15, textAlign: 'center', marginTop: 8 },
});
