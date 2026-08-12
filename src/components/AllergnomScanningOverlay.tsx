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

import { AllergnomShelfLoader } from './AllergnomShelfLoader';
import { useI18n } from '../i18n/I18nContext';

// Frame-by-frame instead of an animated GIF: React Native's Image does not
// animate GIFs on Android, and pulling in a native image library crashed the
// iOS build. Plain PNG frames animate identically on both platforms.
const WALK_FRAMES = [
  require('../../assets/allergnom/walk1.png'),
  require('../../assets/allergnom/walk2.png'),
  require('../../assets/allergnom/walk3.png'),
  require('../../assets/allergnom/walk4.png'),
  require('../../assets/allergnom/walk5.png'),
  require('../../assets/allergnom/walk6.png'),
];
const WALK_FRAME_MS = 110;
const SCREEN_WIDTH = Dimensions.get('window').width;
const WALKER_SIZE = 90;

// The original gif ran 24 frames @ 100ms: walk, stop and inspect, walk again.
// The pause is kept here so he still stops mid-screen to check the label.
/** Past this the read counts as slow and the shelf hunt takes over. */
const SLOW_SCAN_MS = 6000;
const WALK_1_MS = 700;
const PAUSE_MS = 1100;
const WALK_2_MS = 600;
const START_X = -WALKER_SIZE;
const END_X = SCREEN_WIDTH;
const TOTAL_WALK_MS = WALK_1_MS + WALK_2_MS;
const TOTAL_DISTANCE = END_X - START_X;
const CHECK_X = START_X + (TOTAL_DISTANCE * WALK_1_MS) / TOTAL_WALK_MS;

interface AllergnomScanningOverlayProps {
  visible: boolean;
  imageUri: string | null;
}

/** Full-screen "checking your photo" overlay: the label fills the screen, Allergnom walks over it. */
export function AllergnomScanningOverlay({ visible, imageUri }: AllergnomScanningOverlayProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const walkX = useRef(new Animated.Value(START_X)).current;
  const [takingLong, setTakingLong] = useState(false);
  const [frame, setFrame] = useState(0);

  // Cycle the walk frames while the overlay is up.
  useEffect(() => {
    if (!visible) return;
    const handle = setInterval(
      () => setFrame((f) => (f + 1) % WALK_FRAMES.length),
      WALK_FRAME_MS
    );
    return () => clearInterval(handle);
  }, [visible]);

  // A slow read gets the shelf-hunt animation so the wait feels less stuck.
  useEffect(() => {
    if (!visible) {
      setTakingLong(false);
      return;
    }
    const handle = setTimeout(() => setTakingLong(true), SLOW_SCAN_MS);
    return () => clearTimeout(handle);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    walkX.setValue(START_X);
    // Mirrors the gif's own walk → pause-and-check → walk cycle timing so the
    // horizontal movement stops exactly while he's bent down looking at the photo.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walkX, {
          toValue: CHECK_X,
          duration: WALK_1_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(walkX, {
          toValue: CHECK_X,
          duration: PAUSE_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(walkX, {
          toValue: END_X,
          duration: WALK_2_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, walkX]);

  if (!imageUri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.root}>
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <View style={styles.dim} />

        {takingLong ? (
          <View style={styles.slowWrap}>
            <AllergnomShelfLoader />
          </View>
        ) : (
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
              source={WALK_FRAMES[frame]}
              style={styles.walkerImage}
              resizeMode="contain"
            />
          </Animated.View>
        )}

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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  slowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
