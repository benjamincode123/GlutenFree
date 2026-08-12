import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

const SHELF = require('../../assets/allergnom/shelf.png');

/** One knob for the whole animation's footprint. */
const SCALE = 0.7;
const SHELF_W = Math.round(250 * SCALE);
const SHELF_H = Math.round((SHELF_W * 252) / 359);
const GNOME_H = Math.round(126 * SCALE);

/** Natural sizes so each pose keeps its own aspect ratio at a shared height. */
const FRAMES = [
  { source: require('../../assets/allergnom/look.png'), w: 93, h: 210 },
  { source: require('../../assets/allergnom/look1.png'), w: 102, h: 208 },
  { source: require('../../assets/allergnom/look2.png'), w: 101, h: 208 },
  { source: require('../../assets/allergnom/look3.png'), w: 89, h: 214 },
  { source: require('../../assets/allergnom/look4.png'), w: 127, h: 206 },
].map((frame) => ({
  source: frame.source,
  width: Math.round((GNOME_H * frame.w) / frame.h),
}));

/** Poses are absolutely positioned, so the layer needs the widest pose's width. */
const LAYER_W = Math.max(...FRAMES.map((f) => f.width));

interface Step {
  /** Index into FRAMES. */
  frame: number;
  /** Horizontal offset along the shelf. */
  x: number;
  duration: number;
  /** Spin on the Y axis — used when he turns the book over to read it. */
  spin?: boolean;
}

/**
 * Browse along the shelf, pull a book out, then spin around to check it.
 * Offsets are scaled with the shelf so he always walks the same relative span.
 */
const SEQUENCE: Step[] = [
  { frame: 0, x: -62, duration: 420 },
  { frame: 1, x: -62, duration: 420 },
  { frame: 2, x: -24, duration: 420 },
  { frame: 1, x: 22, duration: 420 },
  { frame: 2, x: 60, duration: 420 },
  { frame: 4, x: 60, duration: 560 },
  { frame: 3, x: 16, duration: 900, spin: true },
].map((step) => ({ ...step, x: Math.round(step.x * SCALE) }));

/** Two fast rotations, then he holds still for the rest of the step. */
const SPIN_MS = 380;
const SPIN_TURNS = 2;
/** Short enough to still read as a pose change, long enough to not snap. */
const CROSSFADE_MS = 130;

interface AllergnomShelfLoaderProps {
  /** Optional caption shown under the shelf. */
  label?: string;
}

/** Playful loading animation: Allergnom digs through a bookshelf for answers. */
export function AllergnomShelfLoader({ label }: AllergnomShelfLoaderProps) {
  const { colors } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const slideX = useRef(new Animated.Value(SEQUENCE[0].x)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const stripes = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  // One opacity per pose so swaps can cross-fade instead of hard-cutting.
  const frameOpacity = useRef(
    FRAMES.map((_, index) => new Animated.Value(index === SEQUENCE[0].frame ? 1 : 0))
  ).current;

  // A permanent gentle bob keeps him alive between pose changes.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    const step = SEQUENCE[stepIndex];

    Animated.timing(slideX, {
      toValue: step.x,
      duration: Math.min(step.duration, 320),
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // Cross-fade poses so the sequence flows instead of snapping.
    Animated.parallel(
      frameOpacity.map((value, index) =>
        Animated.timing(value, {
          toValue: index === step.frame ? 1 : 0,
          duration: CROSSFADE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      )
    ).start();

    if (step.spin) {
      spin.setValue(0);
      stripes.setValue(0);
      Animated.parallel([
        // Fast and linear so it reads as a whip-round, not a slow turn.
        Animated.timing(spin, {
          toValue: 1,
          duration: SPIN_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(stripes, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(stripes, {
            toValue: 0,
            duration: SPIN_MS - 90,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      spin.setValue(0);
      stripes.setValue(0);
    }

    const handle = setTimeout(
      () => setStepIndex((index) => (index + 1) % SEQUENCE.length),
      step.duration
    );
    return () => clearTimeout(handle);
  }, [stepIndex, slideX, spin, stripes, frameOpacity]);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Image source={SHELF} style={styles.shelf} resizeMode="contain" />

        <Animated.View
          style={[
            styles.gnomeLayer,
            {
              transform: [
                { translateX: slideX },
                {
                  translateY: bob.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View style={[styles.stripes, { opacity: stripes }]}>
            <View style={[styles.stripe, styles.stripeTop]} />
            <View style={[styles.stripe, styles.stripeMid]} />
            <View style={[styles.stripe, styles.stripeLow]} />
          </Animated.View>

          {/*
           * A flat image rotated on Y shows its mirror image for half the turn,
           * which reads as him facing backwards. So render two faces: the back
           * one is pre-mirrored and offset 180deg, and backfaceVisibility hides
           * whichever is currently turned away.
           */}
          {[false, true].map((isBack) => (
            <Animated.View
              key={isBack ? 'back' : 'front'}
              style={[
                styles.face,
                {
                  transform: [
                    { perspective: 800 },
                    {
                      rotateY: spin.interpolate({
                        inputRange: [0, 1],
                        outputRange: isBack
                          ? ['180deg', `${180 + 360 * SPIN_TURNS}deg`]
                          : ['0deg', `${360 * SPIN_TURNS}deg`],
                      }),
                    },
                    ...(isBack ? [{ scaleX: -1 }] : []),
                  ],
                },
              ]}
            >
              {/* All poses stay mounted and cross-fade — no decode flicker. */}
              {FRAMES.map((frame, index) => (
                <Animated.Image
                  key={index}
                  source={frame.source}
                  style={[
                    styles.gnome,
                    {
                      width: frame.width,
                      height: GNOME_H,
                      left: (LAYER_W - frame.width) / 2,
                      opacity: frameOpacity[index],
                    },
                  ]}
                  resizeMode="contain"
                />
              ))}
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 8,
  },
  stage: {
    width: SHELF_W,
    height: SHELF_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shelf: {
    ...StyleSheet.absoluteFillObject,
    width: SHELF_W,
    height: SHELF_H,
  },
  gnomeLayer: {
    position: 'absolute',
    bottom: 0,
    width: LAYER_W,
    height: GNOME_H,
  },
  face: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
  },
  gnome: {
    position: 'absolute',
    bottom: 0,
  },
  stripes: {
    position: 'absolute',
    left: Math.round(-34 * SCALE),
    right: Math.round(-34 * SCALE),
    top: '22%',
    gap: Math.round(9 * SCALE),
  },
  stripe: {
    height: Math.max(2, Math.round(3 * SCALE)),
    borderRadius: 2,
    backgroundColor: '#5B3A1E',
    opacity: 0.5,
  },
  stripeTop: {
    width: '38%',
    alignSelf: 'flex-start',
  },
  stripeMid: {
    width: '52%',
    alignSelf: 'flex-end',
  },
  stripeLow: {
    width: '32%',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
