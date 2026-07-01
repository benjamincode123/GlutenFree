import { StyleSheet, Text, View } from 'react-native';

import { getGlutenRatingMeta, GlutenRating } from '../db/types';

interface GlutenBadgeProps {
  rating: GlutenRating;
  size?: 'small' | 'large';
}

export function GlutenBadge({ rating, size = 'small' }: GlutenBadgeProps) {
  const meta = getGlutenRatingMeta(rating);
  const isLarge = size === 'large';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: meta.backgroundColor },
        isLarge && styles.badgeLarge,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text
        style={[styles.label, { color: meta.color }, isLarge && styles.labelLarge]}
      >
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelLarge: {
    fontSize: 16,
  },
});
