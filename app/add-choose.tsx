import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useI18n } from '../src/i18n/I18nContext';
import { useReliableBackHeader } from '../src/navigation/useReliableBackHeader';
import { useTheme } from '../src/theme/ThemeContext';

const CORNER_IMAGE = require('../assets/allergnom/allergnom-corner.png');

/** Natural size of allergnom-corner.png (481x905). */
const CORNER_ASPECT = 481 / 905;
const CORNER_WIDTH = 92;
const CORNER_HEIGHT = CORNER_WIDTH / CORNER_ASPECT;

export default function AddChooseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  useReliableBackHeader({ title: t('nav.add') });

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(10)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsY = useRef(new Animated.Value(16)).current;
  const peekX = useRef(new Animated.Value(28)).current;
  const peekOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonsY, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(peekOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(peekX, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [titleOpacity, titleY, buttonsOpacity, buttonsY, peekX, peekOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.headerBlock,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {t('add.chooseTitle')}
        </Text>
        <Text style={[styles.lead, { color: colors.textSecondary }]}>
          {t('add.chooseLead')}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.choices,
          {
            opacity: buttonsOpacity,
            transform: [{ translateY: buttonsY }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.choice,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={() => router.push('/add')}
          accessibilityRole="button"
          accessibilityLabel={t('add.chooseManual')}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={28}
              color={colors.text}
            />
          </View>
          <View style={styles.choiceText}>
            <Text style={[styles.choiceTitle, { color: colors.text }]}>
              {t('add.chooseManual')}
            </Text>
            <Text style={[styles.choiceHint, { color: colors.textSecondary }]}>
              {t('add.chooseManualHint')}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={26}
            color={colors.textSecondary}
          />
        </Pressable>

        <View style={styles.allergnomWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.choice,
              styles.allergnomChoice,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() =>
              router.push({ pathname: '/add', params: { aiFocus: '1' } })
            }
            accessibilityRole="button"
            accessibilityLabel={t('add.chooseAllergnom')}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.onPrimary,
                  borderColor: colors.onPrimary,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="magnify-scan"
                size={28}
                color={colors.primary}
              />
            </View>
            <View style={styles.choiceText}>
              <Text style={[styles.choiceTitle, { color: colors.onPrimary }]}>
                {t('add.chooseAllergnom')}
              </Text>
              <Text
                style={[styles.choiceHint, { color: colors.onPrimary, opacity: 0.78 }]}
              >
                {t('add.chooseAllergnomHint')}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={26}
              color={colors.onPrimary}
            />
          </Pressable>

          <Animated.Image
            source={CORNER_IMAGE}
            style={[
              styles.cornerPeek,
              {
                opacity: peekOpacity,
                transform: [{ translateX: peekX }],
              },
            ]}
            resizeMode="contain"
            accessibilityLabel={t('allergnom.introImageA11y')}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  headerBlock: {
    marginBottom: 28,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  lead: {
    fontSize: 16,
    lineHeight: 22,
  },
  choices: {
    gap: 18,
  },
  choice: {
    minHeight: 118,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  allergnomWrap: {
    position: 'relative',
    overflow: 'visible',
  },
  allergnomChoice: {
    paddingRight: 56,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    flex: 1,
    gap: 4,
  },
  choiceTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  choiceHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  cornerPeek: {
    position: 'absolute',
    right: -10,
    bottom: -6,
    width: CORNER_WIDTH,
    height: CORNER_HEIGHT,
    zIndex: 2,
  },
});
