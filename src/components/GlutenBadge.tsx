import { StyleSheet, Text, View } from 'react-native';

import { GlutenRating } from '../db/types';
import { useI18n } from '../i18n/I18nContext';
import { TranslationKey } from '../i18n/translations';

interface GlutenBadgeProps {
  rating: GlutenRating;
  size?: 'small' | 'large';
}

const RATING_STYLE: Record<
  GlutenRating,
  { color: string; backgroundColor: string; labelKey: TranslationKey }
> = {
  [GlutenRating.GlutenFree]: {
    color: '#1B7F3B',
    backgroundColor: '#E4F6E9',
    labelKey: 'rating.glutenFree',
  },
  [GlutenRating.GlutenTrace]: {
    color: '#B26A00',
    backgroundColor: '#FCF0DA',
    labelKey: 'rating.glutenTrace',
  },
  [GlutenRating.GlutenContent]: {
    color: '#B3261E',
    backgroundColor: '#FBE5E4',
    labelKey: 'rating.glutenContent',
  },
};

export function GlutenBadge({ rating, size = 'small' }: GlutenBadgeProps) {
  const { t } = useI18n();
  const meta = RATING_STYLE[rating];
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
        {t(meta.labelKey)}
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
