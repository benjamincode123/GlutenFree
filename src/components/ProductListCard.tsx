import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, Image } from 'react-native';

import {
  isFreeFromAllAllergens,
  productHasAllergenData,
} from '../allergens/allergenPrefs';
import type { Product, ProductAllergens, ProductCatalog } from '../db/types';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { AllergenBadge, FreeFromAllBadge } from './AllergenBadge';

export type ProductListCardData = Pick<
  Product,
  'name' | 'produsent' | 'productionCountry' | 'glutenRating' | 'imageUrl'
> & {
  allergens?: ProductAllergens | null;
};

type AllergenChip = {
  name: string;
  kind: 'contains' | 'mayContain';
};

/** Show this many chips when the list fits; above that, show fewer + "see all". */
const ALLERGEN_CHIP_LIMIT = 3;
const ALLERGEN_CHIP_PREVIEW = 2;

function productImageUri(imageUrl: string | null | undefined): string | null {
  const raw = (imageUrl ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function buildAllergenChips(
  allergens: ProductAllergens | null | undefined
): AllergenChip[] {
  if (!productHasAllergenData(allergens)) return [];
  const chips: AllergenChip[] = [];
  for (const name of allergens!.inneholder ?? []) {
    const trimmed = name?.trim();
    if (trimmed) chips.push({ name: trimmed, kind: 'contains' });
  }
  for (const name of allergens!.kanInneholde ?? []) {
    const trimmed = name?.trim();
    if (trimmed) chips.push({ name: trimmed, kind: 'mayContain' });
  }
  return chips;
}

interface ProductListCardProps {
  product: ProductListCardData | null;
  /** Shown when product name is missing (e.g. catalog #id). */
  fallbackTitle: string;
  onPress: () => void;
  /** Optional trailing control (favorite / remove / list actions). */
  trailing?: ReactNode;
  /** When set, truncated allergen rows can open the full allergen screen. */
  allergenNav?: { catalog: ProductCatalog; id: number } | null;
  /** Search results: square photo on the left, same height as the tile. */
  showImage?: boolean;
}

/**
 * Shared product row used by search results, favorites, and shopping lists.
 * Allergen chips are capped; "See all" opens the full declaration screen.
 */
export function ProductListCard({
  product,
  fallbackTitle,
  onPress,
  trailing,
  allergenNav = null,
  showImage = false,
}: ProductListCardProps) {
  const router = useRouter();
  const { t, tf } = useI18n();
  const { colors } = useTheme();

  const chips = buildAllergenChips(product?.allergens);
  const freeFromAll =
    !!product &&
    chips.length === 0 &&
    (!productHasAllergenData(product.allergens) ||
      isFreeFromAllAllergens(product.allergens));

  const needsTruncate = chips.length > ALLERGEN_CHIP_LIMIT;
  const visibleChips = needsTruncate
    ? chips.slice(0, ALLERGEN_CHIP_PREVIEW)
    : chips;
  const hiddenCount = needsTruncate ? chips.length - ALLERGEN_CHIP_PREVIEW : 0;

  const openAllergens = () => {
    if (!allergenNav) return;
    router.push({
      pathname: '/product-allergens',
      params: {
        id: String(allergenNav.id),
        catalog: allergenNav.catalog,
        name: product?.name?.trim() || fallbackTitle,
      },
    });
  };

  const imageUri = showImage ? productImageUri(product?.imageUrl) : null;

  return (
    <Pressable
      style={[
        styles.row,
        showImage && styles.rowWithImage,
        { backgroundColor: colors.background },
      ]}
      onPress={onPress}
    >
      {showImage ? (
        <View style={[styles.thumb, { backgroundColor: colors.surface }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.thumbImage}
              resizeMode="cover"
              accessibilityLabel={product?.name?.trim() || fallbackTitle}
            />
          ) : (
            <MaterialCommunityIcons
              name="image-outline"
              size={22}
              color={colors.textSecondary}
            />
          )}
        </View>
      ) : null}
      <View style={showImage ? styles.rowInset : styles.rowStack}>
        {product?.produsent?.trim() ? (
          <Text
            style={[styles.produsent, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {product.produsent.trim()}
          </Text>
        ) : null}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {product?.name?.trim() || fallbackTitle}
        </Text>
        {product?.productionCountry?.trim() ? (
          <Text
            style={[styles.country, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {product.productionCountry.trim()}
          </Text>
        ) : null}
        <View style={styles.rowLine}>
        <View style={styles.badgeWrap}>
          {freeFromAll ? <FreeFromAllBadge size="small" /> : null}
          {visibleChips.map((chip) => (
            <AllergenBadge
              key={`${chip.kind}-${chip.name}`}
              name={chip.name}
              kind={chip.kind}
              size="small"
            />
          ))}
          {needsTruncate && allergenNav ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                openAllergens();
              }}
              style={[
                styles.seeAllChip,
                { borderColor: colors.primary, backgroundColor: colors.background },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('products.seeAllAllergens')}
            >
              <Text style={[styles.seeAllText, { color: colors.primary }]}>
                {tf('products.seeAllAllergensCount', {
                  count: String(hiddenCount),
                })}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.primary}
              />
            </Pressable>
          ) : null}
          {needsTruncate && !allergenNav ? (
            <View
              style={[
                styles.seeAllChip,
                { borderColor: colors.border, backgroundColor: colors.background },
              ]}
            >
              <Text style={[styles.seeAllText, { color: colors.textSecondary }]}>
                {tf('products.moreAllergens', { count: String(hiddenCount) })}
              </Text>
            </View>
          ) : null}
        </View>
        {trailing ?? <View style={styles.actionsPlaceholder} />}
      </View>
      </View>
    </Pressable>
  );
}

interface ProductCardIconButtonProps {
  name: ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
  label: string;
  onPress: () => void;
}

export function ProductCardIconButton({
  name,
  color,
  label,
  onPress,
}: ProductCardIconButtonProps) {
  return (
    <Pressable
      style={styles.actionButton}
      hitSlop={8}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={name} size={22} color={color} />
    </Pressable>
  );
}

export function ProductCardActions({ children }: { children: ReactNode }) {
  return <View style={styles.actionsCol}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 2,
  },
  rowWithImage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    marginLeft: 12,
    borderRadius: 8,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  rowStack: {
    gap: 2,
  },
  rowInset: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    gap: 2,
    justifyContent: 'center',
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  seeAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
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
    maxWidth: '75%',
    fontSize: 16,
    fontWeight: '700',
  },
});
