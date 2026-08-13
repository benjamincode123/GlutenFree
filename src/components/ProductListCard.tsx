import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  findAllergenWarnings,
  isFreeFromAllAllergens,
} from '../allergens/allergenPrefs';
import { useAllergenPrefs } from '../allergens/AllergenPrefsContext';
import type { Product, ProductAllergens } from '../db/types';
import { useTheme } from '../theme/ThemeContext';
import { AllergenBadge, FreeFromAllBadge } from './AllergenBadge';

export type ProductListCardData = Pick<
  Product,
  'name' | 'produsent' | 'productionCountry' | 'glutenRating'
> & {
  allergens?: ProductAllergens | null;
};

interface ProductListCardProps {
  product: ProductListCardData | null;
  /** Shown when product name is missing (e.g. catalog #id). */
  fallbackTitle: string;
  onPress: () => void;
  /** Optional trailing control (favorite / remove / list actions). */
  trailing?: ReactNode;
}

/**
 * Shared product row used by search results, favorites, and shopping lists.
 * Warnings only — green "Uten X" tags stay off the list to reduce noise.
 */
export function ProductListCard({
  product,
  fallbackTitle,
  onPress,
  trailing,
}: ProductListCardProps) {
  const { colors } = useTheme();
  const { selected: warnAllergens } = useAllergenPrefs();

  const allergenHits = product
    ? findAllergenWarnings(
        warnAllergens,
        product.allergens,
        product.glutenRating
      )
    : [];
  const freeFromAll =
    !!product &&
    allergenHits.length === 0 &&
    isFreeFromAllAllergens(product.allergens);

  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.background }]}
      onPress={onPress}
    >
      <View style={styles.rowMain}>
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
      </View>
      <View style={styles.rowLine}>
        <View style={styles.badgeWrap}>
          {freeFromAll ? <FreeFromAllBadge size="small" /> : null}
          {allergenHits.map((hit) => (
            <AllergenBadge
              key={`${hit.kind}-${hit.selected}`}
              name={hit.selected}
              kind={hit.kind}
              size="small"
            />
          ))}
        </View>
        {trailing ?? <View style={styles.actionsPlaceholder} />}
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
    flex: 1,
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
    maxWidth: '75%',
    fontSize: 16,
    fontWeight: '700',
  },
});
