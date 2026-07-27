import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

const TRACK_OFF = '#C5CCD4';
const TRACK_ON = '#1B7F3B';
const WIDTH = 52;
const HEIGHT = 32;
const PAD = 3;
const THUMB_SIZE = HEIGHT - PAD * 2;
const TRAVEL = WIDTH - THUMB_SIZE - PAD * 2;

type SmoothSwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
};

/**
 * Switch with fixed track colors so thumb/track animation is not interrupted
 * when surrounding theme colors remount (RN Switch often does that).
 */
export function SmoothSwitch({
  value,
  onValueChange,
  disabled = false,
}: SmoothSwitchProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 7,
      tension: 90,
      overshootClamping: true,
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_OFF, TRACK_ON],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

/** @deprecated Prefer SmoothSwitch — kept for existing imports. */
export const ThemeToggle = SmoothSwitch;

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: {
    opacity: 0.45,
  },
});
