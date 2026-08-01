import { StyleSheet, Text, View } from 'react-native';

import type { AllergenHitKind } from '../allergens/allergenPrefs';
import { useI18n } from '../i18n/I18nContext';

interface AllergenBadgeProps {
  /** Allergen label to show (e.g. "Egg", "Melk"). */
  name: string;
  kind: AllergenHitKind;
  size?: 'small' | 'large';
  /** When false, show only the allergen name (section header already states contains/traces). */
  showKindPrefix?: boolean;
}

const CONTAINS = {
  color: '#B3261E',
  backgroundColor: '#FBE5E4',
};

const MAY_CONTAIN = {
  color: '#B26A00',
  backgroundColor: '#FCF0DA',
};

/** Badge matching GlutenBadge look — one per allergen warning. */
export function AllergenBadge({
  name,
  kind,
  size = 'small',
  showKindPrefix = true,
}: AllergenBadgeProps) {
  const { tf } = useI18n();
  const meta = kind === 'contains' ? CONTAINS : MAY_CONTAIN;
  const isLarge = size === 'large';
  const label = !showKindPrefix
    ? name
    : kind === 'contains'
      ? tf('result.allergenBadgeContains', { name })
      : tf('result.allergenBadgeMayContain', { name });

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: meta.backgroundColor },
        isLarge && styles.badgeLarge,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text
        style={[styles.label, { color: meta.color }, isLarge && styles.labelLarge]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  labelLarge: {
    fontSize: 16,
  },
});
