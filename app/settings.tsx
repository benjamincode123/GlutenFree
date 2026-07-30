import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ALLERGEN_OPTIONS } from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { CountrySelector } from '../src/components/CountrySelector';
import { SmoothSwitch } from '../src/components/SmoothSwitch';
import { useI18n } from '../src/i18n/I18nContext';
import { useTheme } from '../src/theme/ThemeContext';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, setMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { isSelected, toggle } = useAllergenPrefs();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.settings') });
  }, [navigation, t]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.section,
          styles.themeSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons
            name={isDark ? 'weather-night' : 'white-balance-sunny'}
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.theme')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, styles.themeHint, { color: colors.textSecondary }]}>
          {t('settings.themeHint')}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, styles.themeLabel, { color: colors.text }]}>
            {isDark ? t('settings.dark') : t('settings.light')}
          </Text>
          <SmoothSwitch
            value={isDark}
            onValueChange={(dark) => setMode(dark ? 'dark' : 'light')}
          />
        </View>
      </View>

      <View
        style={[
          styles.section,
          styles.languageSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="translate" size={22} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.language')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, styles.languageHint, { color: colors.textSecondary }]}>
          {t('settings.languageHint')}
        </Text>
        <View style={styles.langRow}>
          <LangChip
            label={t('settings.norwegian')}
            active={locale === 'nb'}
            onPress={() => setLocale('nb')}
            colors={colors}
          />
          <LangChip
            label={t('settings.english')}
            active={locale === 'en'}
            onPress={() => setLocale('en')}
            colors={colors}
          />
        </View>
      </View>

      <View
        style={[
          styles.section,
          styles.languageSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="earth" size={22} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.productCountry')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, styles.languageHint, { color: colors.textSecondary }]}>
          {t('settings.productCountryHint')}
        </Text>
        <View style={styles.countryWrap}>
          <CountrySelector />
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons
            name="food-allergy"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.allergens')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, styles.allergenHint, { color: colors.textSecondary }]}>
          {t('settings.allergensHint')}
        </Text>
        <View style={styles.allergenWrap}>
          {ALLERGEN_OPTIONS.map((allergen) => {
            const active = isSelected(allergen);
            return (
              <Pressable
                key={allergen}
                onPress={() => toggle(allergen)}
                style={[
                  styles.allergenChip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.background,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={allergen}
              >
                <Text
                  style={[
                    styles.allergenChipText,
                    { color: active ? colors.onPrimary : colors.text },
                  ]}
                >
                  {allergen}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons
            name="information-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.about')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
          {t('settings.aboutBody')}
        </Text>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.disclaimer')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
          {t('settings.disclaimerBody')}
        </Text>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="barcode-scan" size={22} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.scanning')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
          {t('settings.scanningBody')}
        </Text>
      </View>
    </ScrollView>
  );
}

function LangChip({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.langChip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.background,
        },
      ]}
    >
      <Text
        style={[
          styles.langChipText,
          { color: active ? colors.onPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeSection: {
    minHeight: 148,
  },
  languageSection: {
    minHeight: 148,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  themeHint: {
    minHeight: 42,
  },
  languageHint: {
    minHeight: 42,
  },
  row: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  themeLabel: {
    minWidth: 72,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  langRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  countryWrap: {
    marginTop: 14,
  },
  langChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 46,
    justifyContent: 'center',
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  allergenHint: {
    marginBottom: 4,
  },
  allergenWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  allergenChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
