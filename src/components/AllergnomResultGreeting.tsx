import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

const PEEK_IMAGE = require('../../assets/allergnom/allergnom-peek.png');

/** Far enough down that he is fully tucked behind the results card. */
const HIDDEN_Y = 68;
const JUMP_DELAY_MS = 180;
const JUMP_MS = 480;
const BUBBLE_MS = 260;

interface AllergnomResultGreetingProps {
  text: string;
  bubbleBackground: string;
  bubbleBorder: string;
  textColor: string;
  imageLabel: string;
}

/**
 * Result-page greeting: Allergnom springs up from behind the results card,
 * then his speech bubble pops in. Relies on the card that follows it having a
 * higher zIndex and an opaque background so he can hide behind it.
 */
export function AllergnomResultGreeting({
  text,
  bubbleBackground,
  bubbleBorder,
  textColor,
  imageLabel,
}: AllergnomResultGreetingProps) {
  const jump = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(JUMP_DELAY_MS),
      Animated.timing(jump, {
        toValue: 1,
        duration: JUMP_MS,
        // Overshoot slightly at the top so the hop has some life to it.
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: true,
      }),
      Animated.timing(bubble, {
        toValue: 1,
        duration: BUBBLE_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [jump, bubble]);

  return (
    <Animated.View style={styles.row}>
      <Animated.Image
        source={PEEK_IMAGE}
        style={[
          styles.peek,
          {
            transform: [
              {
                translateY: jump.interpolate({
                  inputRange: [0, 1],
                  outputRange: [HIDDEN_Y, 0],
                }),
              },
            ],
          },
        ]}
        resizeMode="contain"
        accessibilityLabel={imageLabel}
      />
      <Animated.View
        style={[
          styles.bubble,
          { backgroundColor: bubbleBackground, borderColor: bubbleBorder },
          {
            opacity: bubble,
            transform: [
              {
                translateY: bubble.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
              {
                scale: bubble.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={[styles.bubbleText, { color: textColor }]}>{text}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: -4,
    // Below the results card so he can duck behind it.
    zIndex: 0,
  },
  peek: {
    width: 66,
    height: 50,
    marginLeft: 28,
  },
  bubble: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
});
