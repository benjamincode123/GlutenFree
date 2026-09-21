import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '../i18n/I18nContext';

export function isOpenFoodFactsImage(url: string | null | undefined): boolean {
  return (url ?? '').toLowerCase().includes('openfoodfacts');
}

/** Small gray credit sitting on a product photo from Open Food Facts. */
export function OpenFoodFactsCredit({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <View
      pointerEvents="none"
      style={[styles.bar, compact && styles.barCompact]}
    >
      <Text
        style={[styles.label, compact && styles.labelCompact]}
        numberOfLines={compact ? 3 : 2}
      >
        {t('products.openFoodFactsPhoto')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(90, 94, 102, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barCompact: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  label: {
    color: '#F3F4F6',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 7,
    lineHeight: 8,
    fontWeight: '700',
  },
});
