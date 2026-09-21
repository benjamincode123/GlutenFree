import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ALLERGEN_OPTIONS,
  type AllergenOption,
} from '../allergens/allergenPrefs';
import {
  activeProductFilterCount,
  EMPTY_PRODUCT_SEARCH_FILTERS,
  type AllergenFilterMode,
  type ProductSearchFilters,
} from '../data/productSearchFilters';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { AppTextInput } from './KeyboardDismissBar';

type Props = {
  visible: boolean;
  filters: ProductSearchFilters;
  onChange: (filters: ProductSearchFilters) => void;
  onClose: () => void;
};

export function ProductSearchFilterMenu({
  visible,
  filters,
  onChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const active = activeProductFilterCount(filters) > 0;

  const setMode = (option: AllergenOption, mode: AllergenFilterMode) => {
    const next = { ...filters.allergens };
    if (next[option] === mode) {
      delete next[option];
    } else {
      next[option] = mode;
    }
    onChange({ ...filters, allergens: next });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('products.filterTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('products.filterProducer')}
          </Text>
          <AppTextInput
            value={filters.produsent}
            onChangeText={(produsent) => onChange({ ...filters, produsent })}
            placeholder={t('products.filterProducerPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="words"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('products.filterAllergens')}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('products.filterHint')}
          </Text>

          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {ALLERGEN_OPTIONS.map((option) => {
              const mode = filters.allergens[option];
              return (
                <View
                  key={option}
                  style={[styles.row, { borderColor: colors.border }]}
                >
                  <Text style={[styles.allergen, { color: colors.text }]} numberOfLines={2}>
                    {option}
                  </Text>
                  <View style={styles.modes}>
                    <ModeButton
                      label={t('products.filterWithout')}
                      selected={mode === 'without'}
                      onPress={() => setMode(option, 'without')}
                      colors={colors}
                    />
                    <ModeButton
                      label={t('products.filterOnly')}
                      selected={mode === 'only'}
                      onPress={() => setMode(option, 'only')}
                      colors={colors}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {active ? (
            <Pressable
              onPress={() => onChange(EMPTY_PRODUCT_SEARCH_FILTERS)}
              style={[styles.clear, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.clearText, { color: colors.text }]}>
                {t('products.filterClear')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: { text: string; onPrimary: string; primary: string; border: string; surface: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.mode,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary : colors.surface,
        },
      ]}
    >
      <Text
        style={[
          styles.modeText,
          { color: selected ? colors.onPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    maxHeight: '78%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  allergen: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  modes: {
    flexDirection: 'row',
    gap: 6,
  },
  mode: {
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  clear: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
