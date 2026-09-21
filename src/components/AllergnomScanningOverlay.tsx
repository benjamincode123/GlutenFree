import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../i18n/I18nContext';
import {
  ALLERGNOM_LOADER_DELAY_MS,
  useAllergnomLoaderDelay,
} from './useAllergnomLoaderDelay';

// Frame-by-frame instead of an animated GIF: React Native's Image does not
// animate GIFs on Android, and pulling in a native image library crashed the
// iOS build. Plain PNG frames animate identically on both platforms.
//
// Original allergnomensjekker.gif is 24 frames @ 100ms:
// walk A/B → transition → inspect (bent) → inspect (lower) → walk again.
const WALK_FRAMES = [
  require('../../assets/allergnom/walk1.png'),
  require('../../assets/allergnom/walk2.png'),
];
/** The two bend-down / magnifying-glass poses. */
const INSPECT_FRAMES = [
  require('../../assets/allergnom/inspect1.png'),
  require('../../assets/allergnom/inspect2.png'),
];

const WALK_FRAME_MS = 110;
const INSPECT_FRAME_MS = 350;
const SCREEN_WIDTH = Dimensions.get('window').width;
const WALKER_SIZE = 90;

const WALK_1_MS = 700;
const PAUSE_MS = 1100;
const WALK_2_MS = 600;
const START_X = -WALKER_SIZE;
const END_X = SCREEN_WIDTH;
const TOTAL_WALK_MS = WALK_1_MS + WALK_2_MS;
const TOTAL_DISTANCE = END_X - START_X;
const CHECK_X = START_X + (TOTAL_DISTANCE * WALK_1_MS) / TOTAL_WALK_MS;

type WalkPhase = 'walk1' | 'inspect' | 'walk2';

interface AllergnomScanningOverlayProps {
  visible: boolean;
  imageUri: string | null;
  /** Delay before the overlay appears. Default keeps fast scans feeling instant. */
  delayMs?: number;
}

/** Full-screen "checking your photo" overlay: the label fills the screen, Allergnom walks over it. */
export function AllergnomScanningOverlay({
  visible,
  imageUri,
  delayMs = ALLERGNOM_LOADER_DELAY_MS,
}: AllergnomScanningOverlayProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const walkX = useRef(new Animated.Value(START_X)).current;
  const [phase, setPhase] = useState<WalkPhase>('walk1');
  const [frame, setFrame] = useState(0);
  const show = useAllergnomLoaderDelay(visible && Boolean(imageUri), delayMs);

  const activeFrames = phase === 'inspect' ? INSPECT_FRAMES : WALK_FRAMES;
  const frameMs = phase === 'inspect' ? INSPECT_FRAME_MS : WALK_FRAME_MS;

  // Cycle the active pose set for the current phase.
  useEffect(() => {
    if (!show) return;
    setFrame(0);
    const handle = setInterval(
      () => setFrame((f) => (f + 1) % activeFrames.length),
      frameMs
    );
    return () => clearInterval(handle);
  }, [show, phase, activeFrames.length, frameMs]);

  useEffect(() => {
    if (!show) return;
    walkX.setValue(START_X);
    setPhase('walk1');

    let cancelled = false;
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;

    const runCycle = () => {
      if (cancelled) return;
      setPhase('walk1');
      walkX.setValue(START_X);

      Animated.timing(walkX, {
        toValue: CHECK_X,
        duration: WALK_1_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        setPhase('inspect');
        phaseTimer = setTimeout(() => {
          if (cancelled) return;
          setPhase('walk2');
          Animated.timing(walkX, {
            toValue: END_X,
            duration: WALK_2_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start(({ finished: done }) => {
            if (!done || cancelled) return;
            // Tiny gap before looping so the exit/enter doesn't hard-cut.
            loopTimer = setTimeout(runCycle, 40);
          });
        }, PAUSE_MS);
      });
    };

    runCycle();
    return () => {
      cancelled = true;
      if (phaseTimer) clearTimeout(phaseTimer);
      if (loopTimer) clearTimeout(loopTimer);
      walkX.stopAnimation();
    };
  }, [show, walkX]);

  if (!imageUri) return null;

  return (
    <Modal visible={show} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.root}>
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.dim} />

        <Animated.View
          style={[
            styles.walker,
            {
              bottom: Math.max(insets.bottom, 24) + 90,
              transform: [{ translateX: walkX }],
            },
          ]}
        >
          <Image
            source={activeFrames[frame % activeFrames.length]}
            style={styles.walkerImage}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={[styles.captionWrap, { bottom: Math.max(insets.bottom, 24) + 20 }]}>
          <Text style={styles.captionText}>{t('add.scanWithAiWorking')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  walker: {
    position: 'absolute',
    left: 0,
    width: WALKER_SIZE,
    height: WALKER_SIZE,
  },
  walkerImage: {
    width: '100%',
    height: '100%',
  },
  captionWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  captionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
