import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AllergenStatus, AllergenStatusMap } from '../allergens/allergenForm';
import { ALLERGEN_OPTIONS } from '../allergens/allergenPrefs';
import { CONTAINS_CHIP, TRACES_CHIP } from '../allergens/allergenChipColors';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

interface AllergenPickerModalProps {
  visible: boolean;
  kind: Extract<AllergenStatus, 'contains' | 'mayContain'>;
  statuses: AllergenStatusMap;
  onToggle: (allergen: string) => void;
  onClose: () => void;
}

export function AllergenPickerModal({
  visible,
  kind,
  statuses,
  onToggle,
  onClose,
}: AllergenPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const accent = kind === 'contains' ? CONTAINS_CHIP : TRACES_CHIP;
  const title =
    kind === 'contains'
      ? t('add.allergenPickerContainsTitle')
      : t('add.allergenPickerMayContainTitle');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('add.allergenPickerDone')}
          >
            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.wrap}>
            {ALLERGEN_OPTIONS.map((allergen) => {
              const active = (statuses[allergen] ?? 'free') === kind;
              return (
                <Pressable
                  key={`${kind}-${allergen}`}
                  onPress={() => onToggle(allergen)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? accent.color : colors.border,
                      backgroundColor: active ? accent.backgroundColor : colors.surface,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${title}: ${allergen}`}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? accent.color : colors.text },
                    ]}
                  >
                    {allergen}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={onClose}
        >
          <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>
            {t('add.allergenPickerDone')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    paddingRight: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  doneButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
