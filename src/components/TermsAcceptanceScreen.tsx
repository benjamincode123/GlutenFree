import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n/I18nContext';
import { acceptCurrentTerms, TERMS_VERSION } from '../legal/termsAcceptance';
import { getTermsSections } from '../legal/termsContent';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  onAccepted: () => void;
};

export function TermsAcceptanceScreen({ onAccepted }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, tf, locale, setLocale } = useI18n();
  const sections = getTermsSections(locale);

  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!agreed || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await acceptCurrentTerms();
      onAccepted();
    } catch {
      setError(t('terms.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.titleFlex, { color: colors.text }]}>
            {t('terms.title')}
          </Text>
          <View style={styles.langSwitch}>
            <Pressable
              onPress={() => setLocale('nb')}
              style={[
                styles.langChip,
                {
                  borderColor: locale === 'nb' ? colors.primary : colors.border,
                  backgroundColor: locale === 'nb' ? colors.primary : colors.surface,
                },
              ]}
            >
              <Text
                style={{
                  color: locale === 'nb' ? colors.onPrimary : colors.text,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                NO
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={[
                styles.langChip,
                {
                  borderColor: locale === 'en' ? colors.primary : colors.border,
                  backgroundColor: locale === 'en' ? colors.primary : colors.surface,
                },
              ]}
            >
              <Text
                style={{
                  color: locale === 'en' ? colors.onPrimary : colors.text,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                EN
              </Text>
            </Pressable>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('terms.subtitle')}
        </Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {tf('terms.versionLabel', { version: TERMS_VERSION })}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.warningBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={22}
            color={colors.primary}
          />
          <Text style={[styles.warningText, { color: colors.text }]}>
            {t('terms.highlight')}
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          style={styles.checkRow}
          onPress={() => setAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: agreed ? colors.primary : colors.border,
                backgroundColor: agreed ? colors.primary : colors.surface,
              },
            ]}
          >
            {agreed ? (
              <MaterialCommunityIcons name="check" size={16} color={colors.onPrimary} />
            ) : null}
          </View>
          <Text style={[styles.checkLabel, { color: colors.text }]}>
            {t('terms.agree')}
          </Text>
        </Pressable>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary },
            (!agreed || saving) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!agreed || saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              {t('terms.continue')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

type DocumentProps = {
  onClose: () => void;
};

/** Read-only terms viewer (e.g. from Settings). */
export function TermsDocumentModal({ onClose }: DocumentProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, tf, locale } = useI18n();
  const sections = getTermsSections(locale);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.modalTitleRow}>
          <Text style={[styles.title, styles.modalTitle, { color: colors.text }]}>
            {t('terms.title')}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {tf('terms.versionLabel', { version: TERMS_VERSION })}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
            {t('common.close')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleFlex: {
    flex: 1,
  },
  langSwitch: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  langChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalTitle: {
    flex: 1,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  version: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
