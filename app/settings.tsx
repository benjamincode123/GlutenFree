import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ALLERGEN_OPTIONS } from '../src/allergens/allergenPrefs';
import { useAllergenPrefs } from '../src/allergens/AllergenPrefsContext';
import { CountrySelector } from '../src/components/CountrySelector';
import { SmoothSwitch } from '../src/components/SmoothSwitch';
import { TermsDocumentModal } from '../src/components/TermsAcceptanceScreen';
import { useI18n } from '../src/i18n/I18nContext';
import { useNotificationPrefs } from '../src/notifications/NotificationPrefsContext';
import { useTheme } from '../src/theme/ThemeContext';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { colors, isDark, setMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { isSelected, toggle } = useAllergenPrefs();
  const {
    prefs,
    permissionGranted,
    setNotifyInbox,
    setNotifyXp,
    enableSystemNotifications,
  } = useNotificationPrefs();
  const [termsOpen, setTermsOpen] = useState(false);

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
            name="bell-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.notifications')}
          </Text>
        </View>
        <Text style={[styles.sectionBody, styles.languageHint, { color: colors.textSecondary }]}>
          {t('settings.notificationsHint')}
        </Text>
        {!permissionGranted ? (
          <Pressable
            style={[styles.permissionBanner, { borderColor: colors.border }]}
            onPress={() => {
              void (async () => {
                const granted = await enableSystemNotifications();
                if (!granted) {
                  void Linking.openSettings();
                }
              })();
            }}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="bell-badge-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.permissionBannerText, { color: colors.text }]}>
              {t('settings.notificationsEnableSystem')}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notificationsInbox')}
            </Text>
            <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
              {t('settings.notificationsInboxHint')}
            </Text>
          </View>
          <SmoothSwitch
            value={prefs.notifyInbox && permissionGranted}
            onValueChange={(value) => {
              void setNotifyInbox(value);
            }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {t('settings.notificationsXp')}
            </Text>
            <Text style={[styles.rowHint, { color: colors.textSecondary }]}>
              {t('settings.notificationsXpHint')}
            </Text>
          </View>
          <SmoothSwitch
            value={prefs.notifyXp && permissionGranted}
            onValueChange={(value) => {
              void setNotifyXp(value);
            }}
          />
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
        <Pressable
          style={[styles.termsLink, { borderColor: colors.border }]}
          onPress={() => setTermsOpen(true)}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.termsLinkText, { color: colors.text }]}>
            {t('terms.openInSettings')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
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

      <Modal
        visible={termsOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setTermsOpen(false)}
      >
        <TermsDocumentModal onClose={() => setTermsOpen(false)} />
      </Modal>
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
  termsLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  termsLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
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
    gap: 12,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  themeLabel: {
    minWidth: 72,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionBanner: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 14,
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
