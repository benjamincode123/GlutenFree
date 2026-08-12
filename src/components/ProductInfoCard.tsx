import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

interface ChipAccent {
  color: string;
  backgroundColor: string;
}

/** Bordered card that groups labelled product fields into one tidy block. */
export function InfoCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A single "LABEL / value" row inside an InfoCard. */
export function InfoRow({
  label,
  value,
  emptyLabel,
  numberOfLines,
}: {
  label: string;
  value: string;
  emptyLabel: string;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const trimmed = value.trim();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: trimmed ? colors.text : colors.textSecondary },
        ]}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {trimmed || emptyLabel}
      </Text>
    </View>
  );
}

/** A row whose value is a set of coloured allergen chips. */
export function InfoChipRow({
  label,
  names,
  accent,
  emptyLabel,
}: {
  label: string;
  names: string[];
  accent: ChipAccent;
  emptyLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {names.length > 0 ? (
        <View style={styles.chipWrap}>
          {names.map((name) => (
            <View
              key={name}
              style={[
                styles.chip,
                { borderColor: accent.color, backgroundColor: accent.backgroundColor },
              ]}
            >
              <Text style={[styles.chipText, { color: accent.color }]}>{name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.value, { color: colors.textSecondary }]}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 14,
  },
  row: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
