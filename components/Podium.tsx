import Crown from 'lucide-react-native/icons/crown';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Reveal } from '@/components/Motion';
import { Text } from '@/components/Text';
import { useCategoryPodium } from '@/hooks/useCategoryPodium';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { theme } from '@/theme/tokens';

const places = [1, 2, 3] as const;
const order = [2, 1, 3] as const; // visual order: 2nd, 1st, 3rd, the classic podium arrangement
const labels: Record<(typeof places)[number], string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const heights: Record<(typeof places)[number], number> = { 1: 128, 2: 92, 3: 68 };
// One-off celebration colors: not part of the design system's palette, used only for medal blocks and confetti.
const medal: Record<(typeof places)[number], { face: string; top: string; text: string }> = {
  1: { face: '#F2B33D', top: '#FCDD8F', text: '#6B4A05' },
  2: { face: '#AEB7C2', top: '#DEE3E8', text: '#3F4552' },
  3: { face: '#C97F45', top: '#E6B183', text: '#4A2E12' },
};
const confettiColors = ['#F2B33D', '#0B57D0', '#15803D', '#E11D2E', '#AEB7C2', '#C97F45'];
const standWidth = 100;

/** One medal block: names above it, the place number and a crown on 1st inside the block. */
function Stand({ place, names }: { place: (typeof places)[number]; names: string[] }) {
  const colors = medal[place];
  return (
    <View style={{ alignItems: 'center', width: standWidth }}>
      <View style={{ alignItems: 'center', gap: 2, marginBottom: theme.spacing[8], minHeight: 40 }}>
        {names.map((name) => (
          <Text key={name} numberOfLines={1} style={{ maxWidth: standWidth + 24, textAlign: 'center' }}>{name}</Text>
        ))}
      </View>
      <View style={{ width: '100%', height: heights[place], borderTopLeftRadius: theme.radii.chip, borderTopRightRadius: theme.radii.chip, overflow: 'hidden', ...theme.shadows.scorePanel }}>
        <View style={{ height: 10, backgroundColor: colors.top }} />
        <View style={{ flex: 1, backgroundColor: colors.face, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {place === 1 && <Crown size={22} color={colors.text} strokeWidth={2} />}
          <Text style={{ color: colors.text, fontSize: 24, lineHeight: 28 }}>{labels[place]}</Text>
        </View>
      </View>
    </View>
  );
}

/** A burst of falling confetti, played once when `play` turns true. One shared Animated.Value drives every piece, each reading it through its own delay and drift. */
function Confetti({ play }: { play: boolean }) {
  const reduce = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef(
    Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360),
      size: 6 + Math.random() * 5,
      color: confettiColors[i % confettiColors.length],
    })),
  ).current;

  useEffect(() => {
    if (!play || reduce) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [play, reduce, progress]);

  if (!play || reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => {
        const start = p.delay;
        const end = Math.min(start + 0.75, 1);
        const translateY = progress.interpolate({ inputRange: [start, 1], outputRange: [-16, 230], extrapolate: 'clamp' });
        const translateX = progress.interpolate({ inputRange: [start, 1], outputRange: [0, p.drift], extrapolate: 'clamp' });
        const rotate = progress.interpolate({ inputRange: [start, 1], outputRange: ['0deg', `${p.spin}deg`], extrapolate: 'clamp' });
        const opacity = progress.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={p.id}
            style={{
              position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size * 0.4,
              backgroundColor: p.color, borderRadius: 1, opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

/** A category's 1st, 2nd and 3rd place, drawn as a podium (two athletes share 3rd when the bracket has bronze bouts). Confetti plays once, the first time a place is decided. Nothing until then. */
export function Podium({ categoryId }: { categoryId: string }) {
  const rows = useCategoryPodium(categoryId);
  const [celebrate, setCelebrate] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (rows.length > 0 && !shown.current) {
      shown.current = true;
      setCelebrate(true);
    }
  }, [rows.length]);

  if (rows.length === 0) return null;
  const byPlace = new Map<number, string[]>();
  for (const row of rows) byPlace.set(row.place, [...(byPlace.get(row.place) ?? []), row.athlete_name]);

  return (
    <View style={{ gap: theme.spacing[8] }}>
      <Text variant="subheading">Podium</Text>
      <View style={{ paddingTop: theme.spacing[24] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: theme.spacing[12] }}>
          {order.filter((place) => byPlace.has(place)).map((place, index) => (
            <Reveal key={place} delay={index * 0.08} y={16}>
              <Stand place={place} names={byPlace.get(place)!} />
            </Reveal>
          ))}
        </View>
        <Confetti play={celebrate} />
      </View>
    </View>
  );
}
