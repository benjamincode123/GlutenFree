import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AllergnomScanningOverlay } from './AllergnomScanningOverlay';
import { ErrorText } from './ErrorText';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const CORNER_IMAGE = require('../../assets/allergnom/allergnom-corner.png');

const BUBBLE_KEYS = [
  'allergnom.introGreeting',
  'allergnom.introExplain',
  'allergnom.introCta',
] as const;
/** How long the newest bubble sits before he ducks off to fetch the next one. */
const BUBBLE_HOLD_MS = 620;
const BUBBLE_FADE_MS = 390;
/** Dash off the left edge, reposition while hidden, then dash back in. */
const DASH_OUT_MS = 240;
const DASH_IN_MS = 320;

/** Natural size of allergnom-corner.png (481x905). */
const CORNER_ASPECT = 481 / 905;
const CORNER_WIDTH = 84;
const CORNER_HEIGHT = CORNER_WIDTH / CORNER_ASPECT;
/** Drop him 60% of his own height below the chat so he trails the newest bubble. */
const CORNER_DROP = CORNER_HEIGHT * 0.6;
/** Far enough left that he fully clears the screen edge before repositioning. */
const CORNER_OFFSCREEN_X = -(CORNER_WIDTH + 120);

interface AllergnomIntroProps {
  onScan: () => void;
  scanning: boolean;
  error: string | null;
  capturedPreviewUri: string | null;
}

/** Chat-style introduction to the app mascot that doubles as the AI-scan trigger. */
export function AllergnomIntro({
  onScan,
  scanning,
  error,
  capturedPreviewUri,
}: AllergnomIntroProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  // Bubbles are mounted one at a time (not just faded in) so the chat column
  // actually grows as he "talks" — that growth is what walks him down the page.
  const [visibleCount, setVisibleCount] = useState(1);
  const slideX = useRef(new Animated.Value(0)).current;
  const exitStripes = useRef(new Animated.Value(0)).current;
  const enterStripes = useRef(new Animated.Value(0)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (visibleCount >= BUBBLE_KEYS.length) return;

    const handle = setTimeout(() => {
      // Dash off the left edge…
      Animated.parallel([
        Animated.timing(exitStripes, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: CORNER_OFFSCREEN_X,
          duration: DASH_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !mounted.current) return;
        // …drop the new message while he's hidden, so the jump to his new
        // position never happens on screen…
        exitStripes.setValue(0);
        enterStripes.setValue(1);
        setVisibleCount((count) => count + 1);
        // …then run back in alongside it.
        Animated.parallel([
          Animated.timing(slideX, {
            toValue: 0,
            duration: DASH_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(enterStripes, {
            toValue: 0,
            duration: DASH_IN_MS,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, BUBBLE_HOLD_MS);

    return () => clearTimeout(handle);
  }, [visibleCount, slideX, exitStripes, enterStripes]);

  return (
    <View style={styles.root}>
      <View style={styles.chatArea}>
        <Animated.View
          style={[styles.cornerWrap, { transform: [{ translateX: slideX }] }]}
        >
          {/* Trailing stripes sit opposite his direction of travel. */}
          <SpeedStripes
            style={styles.stripesRight}
            opacity={exitStripes}
            color={colors.textSecondary}
          />
          <SpeedStripes
            style={styles.stripesLeft}
            opacity={enterStripes}
            color={colors.textSecondary}
          />
          <Image
            source={CORNER_IMAGE}
            style={styles.cornerImage}
            resizeMode="contain"
            accessibilityLabel={t('allergnom.introImageA11y')}
          />
        </Animated.View>

        <View style={styles.bubbleList}>
          {BUBBLE_KEYS.slice(0, visibleCount).map((key) => (
            <ChatBubble
              key={key}
              text={t(key)}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              textColor={colors.text}
            />
          ))}
        </View>
      </View>

      <AllergnomScanningOverlay
        visible={scanning && Boolean(capturedPreviewUri)}
        imageUri={capturedPreviewUri}
      />

      <View style={styles.bottomRow}>
        <Pressable
          style={[
            styles.continueButton,
            { backgroundColor: colors.primary, opacity: scanning ? 0.7 : 1 },
          ]}
          disabled={scanning}
          onPress={onScan}
          accessibilityRole="button"
          accessibilityLabel={t('add.takePhoto')}
        >
          {scanning ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons name="camera" size={22} color={colors.onPrimary} />
          )}
          <Text style={[styles.continueButtonText, { color: colors.onPrimary }]}>
            {scanning ? t('add.scanWithAiWorking') : t('add.takePhoto')}
          </Text>
        </Pressable>
      </View>

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
    </View>
  );
}

/** Motion lines that trail the mascot while he dashes on and off screen. */
function SpeedStripes({
  style,
  opacity,
  color,
}: {
  style: object;
  opacity: Animated.Value;
  color: string;
}) {
  return (
    <Animated.View style={[styles.stripes, style, { opacity }]} pointerEvents="none">
      <View style={[styles.stripe, styles.stripeShort, { backgroundColor: color }]} />
      <View style={[styles.stripe, { backgroundColor: color }]} />
      <View style={[styles.stripe, styles.stripeMedium, { backgroundColor: color }]} />
    </Animated.View>
  );
}

/** A single chat bubble that fades and slides in when it mounts. */
function ChatBubble({
  text,
  backgroundColor,
  borderColor,
  textColor,
}: {
  text: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: BUBBLE_FADE_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        { backgroundColor, borderColor },
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.bubbleText, { color: textColor }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  chatArea: {
    flexDirection: 'row',
    // Bottom-aligned so his feet sit level with the newest bubble; as bubbles
    // mount the column grows and he steps down the page with it.
    alignItems: 'flex-end',
  },
  cornerWrap: {
    width: CORNER_WIDTH,
    // Natural aspect keeps him un-squashed; "contain" would otherwise
    // letterbox him in the middle of a stretched box.
    aspectRatio: CORNER_ASPECT,
    marginLeft: -28,
    marginRight: -4,
    // Negative bottom margin hangs him below the row's baseline instead of
    // stretching the row, so he sits half a body lower than the last bubble.
    marginBottom: -CORNER_DROP,
  },
  cornerImage: {
    width: '100%',
    height: '100%',
    // Flip so his reaching arm lands on his left side, toward the bubbles.
    // Kept off the wrapper so it can't invert the dash animation's direction.
    transform: [{ scaleX: -1 }],
  },
  stripes: {
    position: 'absolute',
    top: '32%',
    width: 44,
    gap: 7,
  },
  stripesRight: {
    left: CORNER_WIDTH - 4,
  },
  stripesLeft: {
    right: CORNER_WIDTH - 4,
    alignItems: 'flex-end',
  },
  stripe: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    opacity: 0.55,
  },
  stripeShort: {
    width: '55%',
  },
  stripeMedium: {
    width: '78%',
  },
  bubbleList: {
    flex: 1,
    gap: 8,
    paddingLeft: 12,
  },
  bubble: {
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  bottomRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  continueButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    marginTop: 10,
  },
});
