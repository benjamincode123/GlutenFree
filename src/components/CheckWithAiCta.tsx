import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = {
  subtitle: string;
  label: string;
  onPress: () => void;
};

/** Attention-grabbing CTA for product-not-found → AI check flow. */
export function CheckWithAiCta({ subtitle, label, onPress }: Props) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => {
      pulseLoop.stop();
    };
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
      <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={[styles.label, { color: colors.onPrimary }]}>{label}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={colors.onPrimary}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
