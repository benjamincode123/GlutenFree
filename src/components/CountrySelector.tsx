import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  PRODUCT_COUNTRIES,
  ProductCountry,
  useCountryPrefs,
} from '../country/CountryPrefsContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const LABEL_KEYS: Record<
  ProductCountry,
  'country.no' | 'country.se' | 'country.dk' | 'country.de'
> = {
  no: 'country.no',
  se: 'country.se',
  dk: 'country.dk',
  de: 'country.de',
};

/** Multi-select NO / SE / DK / DE control bound to shared country preferences. */
export function CountrySelector({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { countries, toggleCountry } = useCountryPrefs();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        {PRODUCT_COUNTRIES.map((code) => {
          const active = countries.includes(code);
          return (
            <Pressable
              key={code}
              onPress={() => toggleCountry(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(LABEL_KEYS[code])}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.background,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  compact && styles.chipTextCompact,
                  { color: active ? colors.onPrimary : colors.text },
                ]}
              >
                {code.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  wrapCompact: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '20%',
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipCompact: {
    flexGrow: 0,
    flexBasis: 'auto',
    minWidth: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chipTextCompact: {
    fontSize: 12,
  },
});
