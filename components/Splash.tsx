import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { LogoLockup } from '@/components/LogoLockup';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const native = Platform.OS !== 'web';
const zoomScale = 14;

const stage = 260; // the lockup's width and the square the animation plays in
const markSize = 130;

// The mark is a ring of eight squares (206 units across); the lockup is the same squares split into two clusters of
// four with the name between them (178 x 32 units). Each square's top-left corner in both artworks, left cluster first.
const squareUnits = { mark: 49.693, lockup: 7.7194 };
const squares = [
  { mark: [0, 49.693], lockup: [0, 7.7194] },
  { mark: [0, 106.614], lockup: [0, 16.5615] },
  { mark: [49.693, 0], lockup: [7.7194, 0] },
  { mark: [49.693, 156.307], lockup: [7.7194, 24.2806] },
  { mark: [106.614, 0], lockup: [162.333, 0] },
  { mark: [106.614, 156.307], lockup: [162.333, 24.2806] },
  { mark: [156.307, 49.693], lockup: [170.053, 7.7194] },
  { mark: [156.307, 106.614], lockup: [170.053, 16.5615] },
];

const lockupScale = stage / 178;
const markScale = markSize / 206;
const lockupTop = (stage - 32 * lockupScale) / 2;
const markInset = (stage - markSize) / 2;
const side = squareUnits.lockup * lockupScale;

/** The mark that opens into the lockup: `split` is 0 for the ring of squares and 1 for the wordmark with the squares at its ends. */
function OpeningLogo({ split }: { split: Animated.Value }) {
  return (
    <View style={{ width: stage, height: stage }}>
      {squares.map((square, index) => {
        const from = { x: markInset + square.mark[0] * markScale, y: markInset + square.mark[1] * markScale };
        const to = { x: square.lockup[0] * lockupScale, y: lockupTop + square.lockup[1] * lockupScale };
        const half = { from: (squareUnits.mark * markScale) / 2, to: side / 2 };
        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: to.x,
              top: to.y,
              width: side,
              height: side,
              borderRadius: side * 0.218,
              backgroundColor: '#FFFFFF',
              transform: [
                { translateX: split.interpolate({ inputRange: [0, 1], outputRange: [from.x + half.from - (to.x + half.to), 0] }) },
                { translateY: split.interpolate({ inputRange: [0, 1], outputRange: [from.y + half.from - (to.y + half.to), 0] }) },
                { scale: split.interpolate({ inputRange: [0, 1], outputRange: [(squareUnits.mark * markScale) / side, 1] }) },
              ],
            }}
          />
        );
      })}
      <Animated.View style={{ position: 'absolute', left: 0, top: lockupTop, opacity: split.interpolate({ inputRange: [0.45, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
        <LogoLockup width={stage} color="#FFFFFF" only="letters" />
      </Animated.View>
    </View>
  );
}

/**
 * Launch animation: the white mark fades in on a dark screen, breaks apart into the full lockup, holds, then zooms in
 * until it fills the screen while the backdrop dissolves, revealing the app underneath. With Reduce Motion it shows
 * the lockup and cross-fades.
 */
export function Splash({ onReady, onDone }: { onReady?: () => void; onDone: () => void }) {
  const reduce = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current; // fade-in and settle
  const split = useRef(new Animated.Value(reduce ? 1 : 0)).current; // 0 = the mark, 1 = the lockup
  const zoom = useRef(new Animated.Value(0)).current; // 0 = resting size, 1 = fully zoomed
  const fade = useRef(new Animated.Value(1)).current; // the dark backdrop

  useEffect(() => {
    const play = (value: Animated.Value, toValue: number, duration: number, easing: (t: number) => number) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: native });

    const sequence = reduce
      ? Animated.sequence([Animated.delay(600), play(fade, 0, 250, Easing.out(Easing.quad))])
      : Animated.sequence([
          play(appear, 1, 500, Easing.out(Easing.cubic)),
          Animated.delay(300),
          play(split, 1, 800, Easing.inOut(Easing.cubic)),
          Animated.delay(450),
          Animated.parallel([
            play(zoom, 1, 950, Easing.in(Easing.cubic)),
            Animated.sequence([Animated.delay(500), play(fade, 0, 450, Easing.in(Easing.quad))]),
          ]),
        ]);
    sequence.start(({ finished }) => finished && onDone());
    return () => sequence.stop();
  }, [reduce]);

  const scale = Animated.multiply(
    appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
    zoom.interpolate({ inputRange: [0, 1], outputRange: [1, zoomScale] }),
  );

  return (
    <Animated.View
      onLayout={onReady}
      style={[StyleSheet.absoluteFill, { backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: fade }]}
    >
      <Animated.View style={{ opacity: appear, transform: [{ scale }] }}>
        <OpeningLogo split={split} />
      </Animated.View>
    </Animated.View>
  );
}
